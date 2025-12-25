/**
 * Fonts Detector Module
 * Detects installed fonts using FontFace.load() and canvas measurement
 * Identifies platform version and desktop applications from font signatures
 * Inspired by CreepJS src/fonts/index.ts
 *
 * @module detectors/fonts
 * @see https://github.com/abrahamjuliot/creepjs/tree/master/src/fonts
 */

import { fnv1a32 } from './audioFingerprint.js';

const FONTS_CONFIG = {
    timeout: 3000,
    measurementTimeout: 50,
    emojiSize: 50
};

// Font families to test (comprehensive list from production fingerprinting)
const FONT_LIST = [
    // Core Web Fonts
    'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Courier New', 'Courier',
    'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
    'Trebuchet MS', 'Arial Black', 'Impact',
    
    // Windows Fonts (Critical for detection)
    'Cambria', 'Calibri', 'Candara', 'Consolas', 'Constantia', 'Corbel',
    'Ebrima', 'Franklin Gothic Medium', 'Gabriola', 'Gadugi', 'HoloLens MDL2 Assets',
    'Javanese Text', 'Leelawadee UI', 'Lucida Console', 'Lucida Sans Unicode',
    'Malgun Gothic', 'Microsoft Himalaya', 'Microsoft JhengHei', 'Microsoft New Tai Lue',
    'Microsoft PhagsPa', 'Microsoft Sans Serif', 'Microsoft Tai Le', 'Microsoft YaHei',
    'Microsoft Yi Baiti', 'Mongolian Baiti', 'MS Gothic', 'MV Boli', 'Myanmar Text',
    'Nirmala UI', 'Palatino Linotype', 'Segoe MDL2 Assets', 'Segoe Print',
    'Segoe Script', 'Segoe UI', 'Segoe UI Emoji', 'Segoe UI Historic', 'Segoe UI Symbol',
    'SimSun', 'Sitka', 'Sylfaen', 'Symbol', 'Tahoma', 'Yu Gothic', 'Bahnschrift',
    'Cascadia Code', 'Cascadia Mono', 'Segoe Fluent Icons', 'Segoe UI Variable',
    
    // macOS Fonts (Critical for detection)
    'American Typewriter', 'Andale Mono', 'Apple Chancery', 'Apple Color Emoji',
    'Apple SD Gothic Neo', 'Arial Hebrew', 'Arial Rounded MT Bold', 'Avenir',
    'Avenir Next', 'Avenir Next Condensed', 'Baskerville', 'Big Caslon', 'Bodoni 72',
    'Bradley Hand', 'Brush Script MT', 'Chalkboard', 'Chalkboard SE', 'Charter',
    'Cochin', 'Copperplate', 'Courier', 'DIN Alternate', 'DIN Condensed',
    'Didot', 'Futura', 'Geneva', 'Gill Sans', 'Helvetica Neue', 'Herculanum',
    'Hoefler Text', 'Lucida Grande', 'Luminari', 'Marker Felt', 'Menlo',
    'Monaco', 'Noteworthy', 'Optima', 'Papyrus', 'Phosphate', 'Rockwell',
    'Savoye LET', 'SignPainter', 'Skia', 'Snell Roundhand', 'Superclarendon',
    'Thonburi', 'Trattatello', 'Zapfino', 'San Francisco', 'SF Pro', 'New York',
    'SF Mono', 'SF Compact', 'SF Arabic', 'Al Nile', 'Baghdad', 'Damascus',
    
    // Linux Fonts
    'Liberation Sans', 'Liberation Serif', 'Liberation Mono', 'Ubuntu', 'Ubuntu Mono',
    'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'Noto Sans', 'Noto Serif',
    'Droid Sans', 'Droid Serif', 'Droid Sans Mono', 'FreeSans', 'FreeSerif', 'FreeMono',
    'Cantarell', 'Nimbus Sans', 'Nimbus Roman',
    
    // Office Suite Fonts (Critical for application detection)
    'Cambria Math', 'Century Gothic', 'Century Schoolbook', 'Meiryo', 'MS Mincho',
    'Wingdings', 'Wingdings 2', 'Wingdings 3', 'Webdings', 'MS PGothic', 'MS PMincho',
    
    // Adobe Fonts (Critical for Creative Suite detection)
    'Adobe Arabic', 'Adobe Caslon Pro', 'Adobe Devanagari', 'Adobe Fan Heiti Std',
    'Adobe Fangsong Std', 'Adobe Garamond Pro', 'Adobe Gothic Std', 'Adobe Gurmukhi',
    'Adobe Hebrew', 'Adobe Heiti Std', 'Adobe Kaiti Std', 'Adobe Ming Std',
    'Adobe Myungjo Std', 'Adobe Song Std', 'Minion Pro', 'Myriad Pro',
    'Adobe Naskh Medium', 'Arno Pro', 'Bickham Script Pro', 'Chaparral Pro',
    
    // Google Fonts (common preinstalled/web fonts)
    'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald', 'Source Sans Pro',
    'Raleway', 'PT Sans', 'Merriweather', 'Noto Sans CJK', 'Material Icons',
    
    // Asian Fonts (Important for regional detection)
    'Hiragino Sans', 'Hiragino Kaku Gothic Pro', 'Hiragino Mincho Pro', 'Osaka',
    'MS Gothic', 'MS Mincho', 'Yu Gothic', 'Yu Mincho', 'Meiryo',
    'SimHei', 'SimSun', 'Microsoft YaHei', 'KaiTi', 'FangSong',
    'Malgun Gothic', 'Batang', 'Dotum', 'Gulim', 'Gungsuh',
    'PingFang SC', 'PingFang TC', 'PingFang HK', 'Heiti SC', 'Heiti TC',
    'STHeiti', 'STSong', 'STKaiti', 'STFangsong',
    
    // Emoji & Symbol Fonts
    'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji',
    'Segoe UI Symbol', 'Symbola', 'Zapf Dingbats',
    
    // Additional common fonts from feedback
    'Verdana Pro', 'Georgia Pro', 'Arial Nova', 'Rockwell Nova', 'Gill Sans Nova',
    'Times New Roman PS', 'Courier New Baltic', 'system-ui', 'BlinkMacSystemFont'
];

// Platform-specific font signatures (CreepJS method)
const PLATFORM_FONTS = {
    windows: {
        '7': ['Calibri', 'Cambria', 'Consolas', 'Corbel', 'Candara', 'Constantia'],
        '8': ['Segoe UI', 'Ebrima', 'Gadugi', 'Myanmar Text', 'Nirmala UI'],
        '8.1': ['Segoe UI', 'Ebrima', 'Gadugi', 'Myanmar Text', 'Nirmala UI', 'Yu Gothic'],
        '10': ['HoloLens MDL2 Assets', 'Segoe MDL2 Assets', 'Segoe UI Emoji', 'Segoe UI Historic', 'Segoe UI Symbol'],
        '11': ['Segoe UI Variable', 'Segoe Fluent Icons']
    },
    macos: {
        '10.9': ['Helvetica Neue', 'Avenir Next'],
        '10.10': ['San Francisco'],
        '10.11': ['San Francisco', 'Avenir Next'],
        '10.13': ['Charter', 'Seravek'],
        '11': ['New York', 'SF Mono', 'SF Pro'],
        '12': ['SF Pro', 'SF Compact', 'SF Mono', 'New York'],
        '13': ['SF Pro', 'SF Compact', 'SF Mono', 'New York', 'SF Arabic']
    },
    linux: {
        ubuntu: ['Ubuntu', 'Ubuntu Mono', 'Ubuntu Condensed'],
        debian: ['DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono'],
        fedora: ['Liberation Sans', 'Liberation Serif', 'Liberation Mono']
    }
};

// Desktop application font signatures (CreepJS method)
const APP_FONTS = {
    'Microsoft Office': ['Cambria Math', 'Calibri', 'Cambria', 'Century Gothic'],
    'Adobe Creative Suite': ['Adobe Arabic', 'Adobe Caslon Pro', 'Adobe Devanagari', 'Minion Pro', 'Myriad Pro'],
    'LibreOffice': ['Liberation Sans', 'Liberation Serif', 'Liberation Mono'],
    'OpenOffice': ['OpenSymbol', 'Gentium Basic', 'Gentium Book Basic']
};

// Emoji test characters (CreepJS method for emoji fingerprinting)
const EMOJI_CHARS = ['😀', '😃', '😄', '😁', '😊', '🤣', '😂', '🙂', '😉', '😍'];

/**
 * Fonts Detector Class
 */
class FontsDetector {
    constructor(config = {}) {
        this.config = { ...FONTS_CONFIG, ...config };
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
        if (typeof document === 'undefined') {
            return this._getUnsupportedResult('document-unavailable');
        }

        if (!document.fonts || typeof document.fonts.load !== 'function') {
            return this._getUnsupportedResult('fontface-api-unavailable');
        }

        try {
            const availableFonts = await this._testFonts();
            const platformInfo = this._detectPlatform(availableFonts);
            const appInfo = this._detectApplications(availableFonts);
            const emojiMetrics = await this._measureEmoji();
            const osMismatch = this._detectOSMismatch(platformInfo);

            const fontHash = fnv1a32(availableFonts.sort().join('|'));
            const emojiHash = fnv1a32(JSON.stringify(emojiMetrics));

            return {
                supported: true,
                fonts: availableFonts,
                fontsCount: availableFonts.length,
                fontHash,
                platform: platformInfo,
                applications: appInfo,
                emoji: emojiMetrics,
                emojiHash,
                osMismatch,
                error: null
            };
        } catch (error) {
            return {
                supported: true,
                fonts: [],
                fontsCount: 0,
                fontHash: fnv1a32('error'),
                platform: null,
                applications: [],
                emoji: null,
                emojiHash: fnv1a32('error'),
                osMismatch: false,
                error: error.message || 'font-detection-error'
            };
        }
    }

    /**
     * Test fonts using FontFace.load() (CreepJS method)
     * @private
     */
    async _testFonts() {
        const available = [];
        const testPromises = FONT_LIST.map(async (fontFamily) => {
            try {
                // CreepJS: Use FontFace.load() to check if font exists
                const loaded = await Promise.race([
                    document.fonts.load(`12px "${fontFamily}"`),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('timeout')), this.config.measurementTimeout)
                    )
                ]);
                
                // If load succeeded without throwing, font is available
                if (loaded && loaded.size > 0) {
                    available.push(fontFamily);
                }
            } catch (e) {
                // Font not available or timeout
            }
        });

        await Promise.allSettled(testPromises);
        return available;
    }

    /**
     * Detect platform and version from font signatures (CreepJS method)
     * @private
     */
    _detectPlatform(availableFonts) {
        const fontSet = new Set(availableFonts);
        const platforms = [];

        // Check Windows versions
        for (const [version, fonts] of Object.entries(PLATFORM_FONTS.windows)) {
            const matchCount = fonts.filter(f => fontSet.has(f)).length;
            const confidence = fonts.length > 0 ? (matchCount / fonts.length) * 100 : 0;
            if (confidence > 30) {
                platforms.push({
                    os: 'Windows',
                    version,
                    confidence: confidence.toFixed(1),
                    matchedFonts: fonts.filter(f => fontSet.has(f))
                });
            }
        }

        // Check macOS versions
        for (const [version, fonts] of Object.entries(PLATFORM_FONTS.macos)) {
            const matchCount = fonts.filter(f => fontSet.has(f)).length;
            const confidence = fonts.length > 0 ? (matchCount / fonts.length) * 100 : 0;
            if (confidence > 30) {
                platforms.push({
                    os: 'macOS',
                    version,
                    confidence: confidence.toFixed(1),
                    matchedFonts: fonts.filter(f => fontSet.has(f))
                });
            }
        }

        // Check Linux distributions
        for (const [distro, fonts] of Object.entries(PLATFORM_FONTS.linux)) {
            const matchCount = fonts.filter(f => fontSet.has(f)).length;
            const confidence = fonts.length > 0 ? (matchCount / fonts.length) * 100 : 0;
            if (confidence > 30) {
                platforms.push({
                    os: 'Linux',
                    version: distro,
                    confidence: confidence.toFixed(1),
                    matchedFonts: fonts.filter(f => fontSet.has(f))
                });
            }
        }

        // Sort by confidence and return top match
        platforms.sort((a, b) => parseFloat(b.confidence) - parseFloat(a.confidence));
        return platforms.length > 0 ? platforms[0] : null;
    }

    /**
     * Detect installed desktop applications from font signatures (CreepJS method)
     * @private
     */
    _detectApplications(availableFonts) {
        const fontSet = new Set(availableFonts);
        const detected = [];

        for (const [appName, fonts] of Object.entries(APP_FONTS)) {
            const matchCount = fonts.filter(f => fontSet.has(f)).length;
            const confidence = fonts.length > 0 ? (matchCount / fonts.length) * 100 : 0;
            if (matchCount > 0) {
                detected.push({
                    name: appName,
                    confidence: confidence.toFixed(1),
                    matchedFonts: fonts.filter(f => fontSet.has(f)),
                    matchCount
                });
            }
        }

        detected.sort((a, b) => parseFloat(b.confidence) - parseFloat(a.confidence));
        return detected;
    }

    /**
     * Measure emoji rendering for fingerprinting (CreepJS method)
     * @private
     */
    async _measureEmoji() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            const size = this.config.emojiSize;
            canvas.width = size;
            canvas.height = size;

            const measurements = [];

            for (const emoji of EMOJI_CHARS) {
                ctx.clearRect(0, 0, size, size);
                ctx.font = `${size - 10}px Arial`;
                ctx.fillText(emoji, 5, size - 10);

                const imageData = ctx.getImageData(0, 0, size, size);
                const pixels = imageData.data;

                // Count non-transparent pixels
                let filledPixels = 0;
                for (let i = 3; i < pixels.length; i += 4) {
                    if (pixels[i] > 0) filledPixels++;
                }

                measurements.push({
                    emoji,
                    filledPixels,
                    width: size,
                    height: size
                });
            }

            return {
                supported: true,
                measurements,
                avgFilledPixels: (measurements.reduce((sum, m) => sum + m.filledPixels, 0) / measurements.length).toFixed(2)
            };
        } catch (e) {
            return {
                supported: false,
                error: e.message || 'emoji-measurement-error'
            };
        }
    }

    /**
     * Detect OS mismatch (fonts don't match reported userAgent) (CreepJS method)
     * @private
     */
    _detectOSMismatch(platformInfo) {
        if (!platformInfo) return false;

        try {
            const ua = navigator.userAgent.toLowerCase();
            const reportedOS = (() => {
                if (ua.includes('windows')) return 'Windows';
                if (ua.includes('mac os x') || ua.includes('macos')) return 'macOS';
                if (ua.includes('linux')) return 'Linux';
                return 'Unknown';
            })();

            // CreepJS: Flag mismatch if detected OS doesn't match reported OS
            return reportedOS !== 'Unknown' && platformInfo.os !== reportedOS;
        } catch (e) {
            return false;
        }
    }

    /**
     * Get unsupported result structure
     * @private
     */
    _getUnsupportedResult(reason) {
        return {
            supported: false,
            fonts: [],
            fontsCount: 0,
            fontHash: fnv1a32('unsupported'),
            platform: null,
            applications: [],
            emoji: null,
            emojiHash: fnv1a32('unsupported'),
            osMismatch: false,
            error: reason
        };
    }

    /**
     * Format metrics for fingerprint display
     * @private
     */
    _formatMetrics(result) {
        return {
            fontsSupported: {
                value: result.supported,
                description: 'Font detection API availability (FontFace.load)',
                risk: result.supported ? 'N/A' : 'LOW'
            },
            fontsCount: {
                value: result.fontsCount,
                description: 'Number of installed fonts detected',
                risk: 'N/A'
            },
            fontHash: {
                value: result.fontHash,
                description: 'FNV-1a hash of installed font list',
                risk: 'N/A'
            },
            fontsPlatformOS: {
                value: result.platform ? result.platform.os : null,
                description: 'Detected OS from font signatures (CreepJS method)',
                risk: 'N/A'
            },
            fontsPlatformVersion: {
                value: result.platform ? result.platform.version : null,
                description: 'Detected OS version from font signatures',
                risk: 'N/A'
            },
            fontsPlatformConfidence: {
                value: result.platform ? `${result.platform.confidence}%` : null,
                description: 'Platform detection confidence level',
                risk: 'N/A'
            },
            fontsApplicationsDetected: {
                value: result.applications.length,
                description: 'Number of desktop applications detected from fonts',
                risk: 'N/A'
            },
            fontsApplicationsList: {
                value: result.applications.map(app => `${app.name} (${app.confidence}%)`).join(', ') || 'None',
                description: 'Detected desktop applications (Office, Adobe, etc.)',
                risk: 'N/A'
            },
            fontsEmojiSupported: {
                value: result.emoji ? result.emoji.supported : false,
                description: 'Emoji rendering measurement support',
                risk: 'N/A'
            },
            fontsEmojiAvgPixels: {
                value: result.emoji && result.emoji.avgFilledPixels ? result.emoji.avgFilledPixels : null,
                description: 'Average filled pixels in emoji rendering',
                risk: 'N/A'
            },
            fontsEmojiHash: {
                value: result.emojiHash,
                description: 'FNV-1a hash of emoji rendering measurements',
                risk: 'N/A'
            },
            fontsOSMismatch: {
                value: result.osMismatch,
                description: 'Whether detected OS mismatches reported userAgent (suspicious)',
                risk: result.osMismatch ? 'HIGH' : 'N/A'
            },
            fontsError: {
                value: result.error || 'None',
                description: 'Font detection error (if any)',
                risk: result.error && result.error !== 'None' ? 'MEDIUM' : 'N/A'
            }
        };
    }
}

// Export
export { FontsDetector };
