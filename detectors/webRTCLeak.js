/**
 * WebRTC Leak Detector Module
 * Detects WebRTC support and collects potential IP leak information
 * Inspired by BrowserLeaks WebRTC test methodology
 * 
 * @module detectors/webRTCLeak
 * @see https://browserleaks.com/webrtc
 */

/**
 * Configuration for WebRTC leak detection
 */
const WEBRTC_CONFIG = {
    // Timeout for ICE gathering in milliseconds
    timeout: 1500,
    
    // STUN server for ICE candidate gathering
    stunServers: [
        { urls: ['stun:stun.l.google.com:19302'] }
    ],
    
    // ICE candidate pool size (0 = don't pre-gather)
    iceCandidatePoolSize: 0,
    
    // Maximum SDP length to store (40KB)
    maxSdpLength: 40000,
    
    // Private IPv4 ranges (RFC 1918)
    privateIPv4Ranges: [
        { start: '10.0.0.0', end: '10.255.255.255', name: '10.x.x.x' },
        { start: '172.16.0.0', end: '172.31.255.255', name: '172.16-31.x.x' },
        { start: '192.168.0.0', end: '192.168.255.255', name: '192.168.x.x' },
        { start: '127.0.0.0', end: '127.255.255.255', name: 'localhost' },
        { start: '169.254.0.0', end: '169.254.255.255', name: 'link-local' }
    ]
};

/**
 * FNV-1a 32-bit hash function (inlined, no dependencies)
 * Same implementation as audioFingerprint.js for consistency
 * @param {string} str - String to hash
 * @returns {string} Hex hash string
 */
function fnv1a32(str) {
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        // FNV prime: 16777619
        hash = Math.imul(hash, 16777619);
    }
    // Convert to unsigned 32-bit and then to hex
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Parse IP address to integer for range comparison
 * @param {string} ip - IPv4 address string
 * @returns {number} Integer representation
 */
function ipToInt(ip) {
    const parts = ip.split('.').map(Number);
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Check if IPv4 address is in a private range
 * @param {string} ip - IPv4 address string
 * @returns {boolean} True if private
 */
function isPrivateIPv4(ip) {
    const ipInt = ipToInt(ip);
    for (const range of WEBRTC_CONFIG.privateIPv4Ranges) {
        const startInt = ipToInt(range.start);
        const endInt = ipToInt(range.end);
        if (ipInt >= startInt && ipInt <= endInt) {
            return true;
        }
    }
    return false;
}

/**
 * Classify an address from a WebRTC candidate
 * @param {string} address - The address from the candidate
 * @returns {string} Classification: private_ipv4, public_ipv4, ipv6, mdns_hostname, unknown
 */
function classifyAddress(address) {
    if (!address) return 'unknown';
    
    // Check for mDNS hostname (ends with .local)
    if (address.endsWith('.local')) {
        return 'mdns_hostname';
    }
    
    // Check for IPv6 (contains colons)
    if (address.includes(':')) {
        return 'ipv6';
    }
    
    // Check for IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(address)) {
        if (isPrivateIPv4(address)) {
            return 'private_ipv4';
        }
        return 'public_ipv4';
    }
    
    return 'unknown';
}

/**
 * Parse an ICE candidate string according to RFC 5245
 * Format: "candidate:<foundation> <component> <protocol> <priority> <address> <port> typ <type> ..."
 * @param {string} candidateString - The candidate string from RTCIceCandidate
 * @returns {Object|null} Parsed candidate object or null if invalid
 */
function parseCandidate(candidateString) {
    if (!candidateString || typeof candidateString !== 'string') {
        return null;
    }
    
    // Remove "candidate:" prefix if present
    let line = candidateString;
    if (line.startsWith('candidate:')) {
        line = line.substring(10);
    } else if (line.startsWith('a=candidate:')) {
        line = line.substring(12);
    }
    
    const parts = line.split(/\s+/);
    if (parts.length < 8) {
        return null;
    }
    
    try {
        const foundation = parts[0];
        const component = parseInt(parts[1], 10);
        const protocol = parts[2].toLowerCase();
        const priority = parseInt(parts[3], 10);
        const address = parts[4];
        const port = parseInt(parts[5], 10);
        
        // Find type (after "typ")
        let type = 'unknown';
        const typIndex = parts.indexOf('typ');
        if (typIndex !== -1 && parts.length > typIndex + 1) {
            type = parts[typIndex + 1];
        }
        
        // Find raddr/rport if present (for srflx/relay candidates)
        let relatedAddress = null;
        let relatedPort = null;
        const raddrIndex = parts.indexOf('raddr');
        if (raddrIndex !== -1 && parts.length > raddrIndex + 1) {
            relatedAddress = parts[raddrIndex + 1];
        }
        const rportIndex = parts.indexOf('rport');
        if (rportIndex !== -1 && parts.length > rportIndex + 1) {
            relatedPort = parseInt(parts[rportIndex + 1], 10);
        }
        
        return {
            foundation,
            component,
            protocol,
            priority,
            address,
            port,
            type,
            relatedAddress,
            relatedPort,
            addressType: classifyAddress(address),
            raw: candidateString
        };
    } catch (e) {
        return null;
    }
}

/**
 * WebRTC Leak Detector
 * Collects WebRTC-related fingerprint data and potential IP leaks
 */
class WebRTCLeakDetector {
    constructor(config = {}) {
        this.config = { ...WEBRTC_CONFIG, ...config };
        this.metrics = {};
        this.result = null;
        this.suspiciousIndicators = [];
    }

    /**
     * Analyze WebRTC capabilities and collect leak data
     * @returns {Promise<Object>} WebRTC metrics
     */
    async analyze() {
        const result = await this.collect();
        this.result = result;
        this.metrics = this._formatMetrics(result);
        
        // Analyze for suspicious patterns
        this._analyzeForSuspiciousPatterns(result);
        
        return this.metrics;
    }

    /**
     * Static collect method matching the design pattern
     * @returns {Promise<Object>} WebRTCLeakResult
     */
    static async collect() {
        const detector = new WebRTCLeakDetector();
        return detector.collect();
    }

    /**
     * Collect WebRTC leak data
     * @returns {Promise<Object>} WebRTCLeakResult
     */
    async collect() {
        const startedAt = Date.now();
        const errors = [];
        
        // Initialize result structure
        const result = {
            supported: {
                RTCPeerConnection: false,
                RTCDataChannel: false
            },
            leakTest: {
                candidateTypesSeen: {
                    host: false,
                    srflx: false,
                    relay: false,
                    prflx: false
                },
                localIPAddresses: [],
                publicIPAddresses: [],
                localCandidates: [],
                iceGatheringStateTimeline: []
            },
            sessionDescription: {
                sdpHash: null,
                sdp: null
            },
            mediaDevices: {
                apiSupported: false,
                permissions: {
                    audio: 'unsupported',
                    video: 'unsupported'
                },
                deviceSummary: {
                    audioinput: 0,
                    videoinput: 0,
                    audiooutput: 0
                },
                devices: []
            },
            timing: {
                startedAt,
                finishedAt: 0,
                durationMs: 0
            },
            errors
        };

        try {
            // Check RTCPeerConnection support
            const RTCPeerConnection = window.RTCPeerConnection || 
                                       window.webkitRTCPeerConnection || 
                                       window.mozRTCPeerConnection;
            
            result.supported.RTCPeerConnection = !!RTCPeerConnection;
            
            if (!RTCPeerConnection) {
                errors.push('RTCPeerConnection not supported');
                result.timing.finishedAt = Date.now();
                result.timing.durationMs = result.timing.finishedAt - startedAt;
                return result;
            }

            // Collect WebRTC leak data
            await this._collectWebRTCData(result, RTCPeerConnection);
            
        } catch (e) {
            errors.push(`WebRTC collection error: ${e.message}`);
        }

        // Collect media devices data (separate try/catch)
        try {
            await this._collectMediaDevicesData(result);
        } catch (e) {
            errors.push(`Media devices error: ${e.message}`);
        }

        result.timing.finishedAt = Date.now();
        result.timing.durationMs = result.timing.finishedAt - startedAt;
        
        return result;
    }

    /**
     * Collect WebRTC ICE candidates and SDP
     * @private
     */
    async _collectWebRTCData(result, RTCPeerConnection) {
        return new Promise((resolve) => {
            let pc = null;
            let timeoutId = null;
            const seenAddresses = new Set();
            const seenPublicAddresses = new Set();
            
            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (pc) {
                    try {
                        pc.onicecandidate = null;
                        pc.onicegatheringstatechange = null;
                        pc.close();
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                    pc = null;
                }
            };
            
            const finalize = () => {
                cleanup();
                
                // Dedupe and finalize address arrays
                result.leakTest.localIPAddresses = Array.from(seenAddresses);
                result.leakTest.publicIPAddresses = Array.from(seenPublicAddresses);
                
                resolve();
            };
            
            try {
                // Create RTCPeerConnection with conservative config
                const config = {
                    iceServers: this.config.stunServers,
                    iceCandidatePoolSize: this.config.iceCandidatePoolSize
                };
                
                pc = new RTCPeerConnection(config);
                
                // Test RTCDataChannel support
                try {
                    const dc = pc.createDataChannel('x');
                    result.supported.RTCDataChannel = true;
                    dc.close();
                } catch (e) {
                    result.supported.RTCDataChannel = false;
                    result.errors.push(`RTCDataChannel test failed: ${e.message}`);
                }
                
                // Track ICE gathering state changes
                pc.onicegatheringstatechange = () => {
                    result.leakTest.iceGatheringStateTimeline.push({
                        state: pc.iceGatheringState,
                        t: Date.now() - result.timing.startedAt
                    });
                    
                    if (pc.iceGatheringState === 'complete') {
                        finalize();
                    }
                };
                
                // Collect ICE candidates
                pc.onicecandidate = (event) => {
                    if (event.candidate && event.candidate.candidate) {
                        const parsed = parseCandidate(event.candidate.candidate);
                        if (parsed) {
                            result.leakTest.localCandidates.push(parsed);
                            
                            // Track candidate types
                            if (parsed.type === 'host') result.leakTest.candidateTypesSeen.host = true;
                            if (parsed.type === 'srflx') result.leakTest.candidateTypesSeen.srflx = true;
                            if (parsed.type === 'relay') result.leakTest.candidateTypesSeen.relay = true;
                            if (parsed.type === 'prflx') result.leakTest.candidateTypesSeen.prflx = true;
                            
                            // Collect addresses - only include valid IPv4 addresses
                            // Ignore mDNS hostnames (e.g., uuid.local) and other non-IP formats
                            if (parsed.address && (parsed.addressType === 'private_ipv4' || parsed.addressType === 'public_ipv4')) {
                                seenAddresses.add(parsed.address);
                                
                                // Public addresses from srflx candidates
                                if (parsed.type === 'srflx' && parsed.addressType === 'public_ipv4') {
                                    seenPublicAddresses.add(parsed.address);
                                }
                            }
                        }
                    }
                };
                
                // Also parse candidates from SDP as fallback
                const parseSdpCandidates = (sdp) => {
                    if (!sdp) return;
                    const lines = sdp.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('a=candidate:')) {
                            const parsed = parseCandidate(line);
                            if (parsed) {
                                // Check if we already have this candidate
                                const exists = result.leakTest.localCandidates.some(
                                    c => c.foundation === parsed.foundation && 
                                         c.address === parsed.address && 
                                         c.port === parsed.port
                                );
                                if (!exists) {
                                    result.leakTest.localCandidates.push(parsed);
                                    
                                    // Only add valid IPv4 addresses (not mDNS hostnames like uuid.local)
                                    if (parsed.address && (parsed.addressType === 'private_ipv4' || parsed.addressType === 'public_ipv4')) {
                                        seenAddresses.add(parsed.address);
                                    }
                                }
                            }
                        }
                    }
                };
                
                // Create offer without media
                const createOfferAndGather = async () => {
                    try {
                        // Create a data channel to trigger ICE gathering
                        pc.createDataChannel('probe');
                        
                        const offer = await pc.createOffer({
                            offerToReceiveAudio: true,
                            offerToReceiveVideo: true
                        });
                        
                        await pc.setLocalDescription(offer);
                        
                        // Store SDP
                        if (pc.localDescription && pc.localDescription.sdp) {
                            const sdp = pc.localDescription.sdp;
                            result.sessionDescription.sdp = sdp.length > this.config.maxSdpLength 
                                ? sdp.substring(0, this.config.maxSdpLength) + '...[truncated]'
                                : sdp;
                            result.sessionDescription.sdpHash = fnv1a32(sdp);
                            
                            // Parse SDP for candidates
                            parseSdpCandidates(sdp);
                        }
                    } catch (e) {
                        result.errors.push(`createOffer failed: ${e.message}`);
                        finalize();
                    }
                };
                
                // Set timeout
                timeoutId = setTimeout(() => {
                    result.errors.push('ICE gathering timeout');
                    finalize();
                }, this.config.timeout);
                
                // Start gathering
                createOfferAndGather();
                
            } catch (e) {
                result.errors.push(`RTCPeerConnection creation failed: ${e.message}`);
                cleanup();
                resolve();
            }
        });
    }

    /**
     * Collect media devices data (privacy-safe)
     * @private
     */
    async _collectMediaDevicesData(result) {
        const nav = navigator;
        
        // Check API support
        result.mediaDevices.apiSupported = !!(nav.mediaDevices && nav.mediaDevices.enumerateDevices);
        
        // Query permissions if available
        if (nav.permissions && nav.permissions.query) {
            try {
                const micPermission = await nav.permissions.query({ name: 'microphone' });
                result.mediaDevices.permissions.audio = micPermission.state;
            } catch (e) {
                result.mediaDevices.permissions.audio = 'unsupported';
            }
            
            try {
                const camPermission = await nav.permissions.query({ name: 'camera' });
                result.mediaDevices.permissions.video = camPermission.state;
            } catch (e) {
                result.mediaDevices.permissions.video = 'unsupported';
            }
        }
        
        // Enumerate devices (privacy-safe - no labels without permission)
        if (result.mediaDevices.apiSupported) {
            try {
                const devices = await nav.mediaDevices.enumerateDevices();
                
                for (const device of devices) {
                    // Count by kind
                    if (device.kind === 'audioinput') result.mediaDevices.deviceSummary.audioinput++;
                    if (device.kind === 'videoinput') result.mediaDevices.deviceSummary.videoinput++;
                    if (device.kind === 'audiooutput') result.mediaDevices.deviceSummary.audiooutput++;
                    
                    // Store privacy-safe device info (no actual IDs or labels)
                    result.mediaDevices.devices.push({
                        kind: device.kind,
                        labelAvailable: !!device.label && device.label.length > 0,
                        deviceIdAvailable: !!device.deviceId && device.deviceId.length > 0 && device.deviceId !== '',
                        groupIdAvailable: !!device.groupId && device.groupId.length > 0 && device.groupId !== ''
                    });
                }
            } catch (e) {
                result.errors.push(`enumerateDevices failed: ${e.message}`);
            }
        }
    }

    /**
     * Format results into metrics object for fingerprint
     * @private
     */
    _formatMetrics(result) {
        return {
            // Support detection
            hasRTCPeerConnection: {
                value: result.supported.RTCPeerConnection,
                description: 'RTCPeerConnection API availability',
                risk: 'N/A'
            },
            hasRTCDataChannel: {
                value: result.supported.RTCDataChannel,
                description: 'RTCDataChannel support (verified)',
                risk: 'N/A'
            },
            
            // Candidate types
            hasHostCandidates: {
                value: result.leakTest.candidateTypesSeen.host,
                description: 'Host (local) candidates detected',
                risk: 'N/A'
            },
            hasSrflxCandidates: {
                value: result.leakTest.candidateTypesSeen.srflx,
                description: 'Server reflexive (STUN) candidates detected',
                risk: 'N/A'
            },
            hasRelayCandidates: {
                value: result.leakTest.candidateTypesSeen.relay,
                description: 'Relay (TURN) candidates detected',
                risk: 'N/A'
            },
            hasPrflxCandidates: {
                value: result.leakTest.candidateTypesSeen.prflx,
                description: 'Peer reflexive candidates detected',
                risk: 'N/A'
            },
            
            // Address counts
            localAddressCount: {
                value: result.leakTest.localIPAddresses.length,
                description: 'Number of local IP addresses detected',
                risk: result.leakTest.localIPAddresses.length > 0 ? 'MEDIUM' : 'LOW'
            },
            publicAddressCount: {
                value: result.leakTest.publicIPAddresses.length,
                description: 'Number of public IP addresses detected via srflx',
                risk: result.leakTest.publicIPAddresses.length > 0 ? 'HIGH' : 'LOW'
            },
            candidateCount: {
                value: result.leakTest.localCandidates.length,
                description: 'Total ICE candidates collected',
                risk: 'N/A'
            },
            
            // Address lists (as comma-separated strings for display)
            localAddresses: {
                value: result.leakTest.localIPAddresses.join(', ') || 'None detected',
                description: 'Local IP addresses (host candidates)',
                risk: result.leakTest.localIPAddresses.length > 0 ? 'MEDIUM' : 'LOW'
            },
            publicAddresses: {
                value: result.leakTest.publicIPAddresses.join(', ') || 'None detected',
                description: 'Public IP addresses (srflx candidates)',
                risk: result.leakTest.publicIPAddresses.length > 0 ? 'HIGH' : 'LOW'
            },
            
            // SDP
            sdpHash: {
                value: result.sessionDescription.sdpHash || 'Not available',
                description: 'FNV-1a hash of SDP (Session Description Protocol)',
                risk: 'N/A'
            },
            sdpLength: {
                value: result.sessionDescription.sdp ? result.sessionDescription.sdp.length : 0,
                description: 'SDP content length in characters',
                risk: 'N/A'
            },
            sdpOffering: {
                value: result.sessionDescription.sdp || 'Not available',
                description: 'Full SDP (Session Description Protocol) offering string for analysis',
                risk: 'N/A',
                isLargeValue: true // Flag to indicate this is a large value that may need special UI handling
            },
            
            // Media devices
            mediaDevicesApiSupported: {
                value: result.mediaDevices.apiSupported,
                description: 'navigator.mediaDevices.enumerateDevices availability',
                risk: 'N/A'
            },
            audioInputCount: {
                value: result.mediaDevices.deviceSummary.audioinput,
                description: 'Number of audio input devices',
                risk: 'N/A'
            },
            videoInputCount: {
                value: result.mediaDevices.deviceSummary.videoinput,
                description: 'Number of video input devices',
                risk: 'N/A'
            },
            audioOutputCount: {
                value: result.mediaDevices.deviceSummary.audiooutput,
                description: 'Number of audio output devices',
                risk: 'N/A'
            },
            microphonePermission: {
                value: result.mediaDevices.permissions.audio,
                description: 'Microphone permission state (granted/denied/prompt/unsupported)',
                risk: 'N/A'
            },
            cameraPermission: {
                value: result.mediaDevices.permissions.video,
                description: 'Camera permission state (granted/denied/prompt/unsupported)',
                risk: 'N/A'
            },
            
            // Timing
            collectionDurationMs: {
                value: result.timing.durationMs,
                description: 'WebRTC data collection duration in milliseconds',
                risk: 'N/A'
            },
            
            // Errors
            errorCount: {
                value: result.errors.length,
                description: 'Number of non-fatal errors during collection',
                risk: result.errors.length > 2 ? 'MEDIUM' : 'N/A'
            },
            errorMessages: {
                value: result.errors.join('; ') || 'None',
                description: 'Error messages encountered during collection',
                risk: 'N/A'
            }
        };
    }

    /**
     * Analyze results for suspicious patterns
     * @private
     */
    _analyzeForSuspiciousPatterns(result) {
        this.suspiciousIndicators = [];
        
        // No WebRTC support might indicate a privacy-focused or sandboxed browser
        if (!result.supported.RTCPeerConnection) {
            this.suspiciousIndicators.push({
                category: 'webrtc',
                name: 'webrtc_not_supported',
                description: 'WebRTC API not available',
                value: 'RTCPeerConnection unavailable',
                riskLevel: 'MEDIUM',
                confidence: 0.5,
                importance: 'WEAK',
                details: 'WebRTC is blocked or not supported, which could indicate privacy browser/extension or sandboxed environment'
            });
        }
        
        // No candidates at all is suspicious
        if (result.supported.RTCPeerConnection && result.leakTest.localCandidates.length === 0) {
            this.suspiciousIndicators.push({
                category: 'webrtc',
                name: 'webrtc_no_candidates',
                description: 'No ICE candidates generated',
                value: '0 candidates',
                riskLevel: 'MEDIUM',
                confidence: 0.6,
                importance: 'WEAK',
                details: 'WebRTC is supported but no candidates were generated, possibly indicating a sandboxed or restricted environment'
            });
        }
        
        // Multiple public IPs is interesting
        if (result.leakTest.publicIPAddresses.length > 1) {
            this.suspiciousIndicators.push({
                category: 'webrtc',
                name: 'webrtc_multiple_public_ips',
                description: 'Multiple public IP addresses detected',
                value: result.leakTest.publicIPAddresses.join(', '),
                riskLevel: 'LOW',
                confidence: 0.4,
                importance: 'WEAK',
                details: 'Multiple public IPs could indicate VPN, multi-homed network, or proxy configuration'
            });
        }
    }

    /**
     * Get suspicious indicators for integration with main detector
     * @returns {Array} Array of suspicious indicator objects
     */
    getSuspiciousIndicators() {
        return this.suspiciousIndicators;
    }

    /**
     * Get the raw result object
     * @returns {Object} Full WebRTCLeakResult
     */
    getResult() {
        return this.result;
    }

    /**
     * Render method for UI integration
     * @param {Object} result - The WebRTC leak result
     * @param {Object} uiTargets - DOM elements for rendering
     */
    static render(result, uiTargets) {
        // This is handled by the existing fingerprint-analysis.html metrics table
        // The result is formatted into metrics and rendered automatically
        console.log('WebRTCLeakDetector render called with:', result);
    }
}

export { WebRTCLeakDetector, WEBRTC_CONFIG };
