/**
 * Agent Detection Overlay Component
 * A professional, modern overlay that appears immediately when an AI agent is detected.
 * Designed with bot protection company aesthetics in mind.
 */

// CSS styles injected once
const OVERLAY_STYLES = `
.agent-detection-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 999999;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: none;
}

.agent-detection-banner {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
    border-bottom: 2px solid #e74c3c;
    box-shadow: 0 4px 20px rgba(231, 76, 60, 0.3), 0 0 40px rgba(231, 76, 60, 0.1);
    padding: 0;
    transform: translateY(-100%);
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: auto;
}

.agent-detection-banner.visible {
    transform: translateY(0);
}

.agent-detection-banner.dismissed {
    transform: translateY(-100%);
}

.banner-content {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    gap: 20px;
}

.banner-left {
    display: flex;
    align-items: center;
    gap: 16px;
}

.threat-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
    animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
    0%, 100% { box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4); }
    50% { box-shadow: 0 4px 20px rgba(231, 76, 60, 0.7), 0 0 30px rgba(231, 76, 60, 0.3); }
}

.threat-icon svg {
    width: 28px;
    height: 28px;
    color: white;
}

.banner-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.banner-title {
    font-size: 15px;
    font-weight: 600;
    color: #ffffff;
    letter-spacing: 0.3px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.banner-title .status-dot {
    width: 8px;
    height: 8px;
    background: #e74c3c;
    border-radius: 50%;
    animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

.banner-subtitle {
    font-size: 13px;
    color: #a0aec0;
    font-weight: 400;
}

.banner-center {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}

.agent-badge {
    background: rgba(231, 76, 60, 0.15);
    border: 1px solid rgba(231, 76, 60, 0.4);
    border-radius: 20px;
    padding: 6px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
}

.agent-badge:hover {
    background: rgba(231, 76, 60, 0.25);
    border-color: rgba(231, 76, 60, 0.6);
}

.agent-badge .agent-name {
    font-size: 13px;
    font-weight: 600;
    color: #e74c3c;
}

.agent-badge .confidence {
    font-size: 11px;
    color: #f39c12;
    font-weight: 500;
    background: rgba(243, 156, 18, 0.15);
    padding: 2px 6px;
    border-radius: 4px;
}

.agent-badge .timestamp {
    font-size: 10px;
    color: #718096;
}

.banner-right {
    display: flex;
    align-items: center;
    gap: 12px;
}

.details-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 8px 16px;
    color: #ffffff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 6px;
}

.details-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
}

.dismiss-btn {
    background: transparent;
    border: none;
    padding: 8px;
    cursor: pointer;
    color: #718096;
    border-radius: 6px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}

.dismiss-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
}

.dismiss-btn svg {
    width: 20px;
    height: 20px;
}

/* Details Panel */
.detection-details-panel {
    background: #0f0f23;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
}

.detection-details-panel.expanded {
    max-height: 400px;
}

.details-content {
    padding: 16px 24px;
    max-width: 1400px;
    margin: 0 auto;
}

.details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
}

.detail-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 14px;
}

.detail-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.detail-card-icon {
    width: 32px;
    height: 32px;
    background: rgba(231, 76, 60, 0.2);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #e74c3c;
}

.detail-card-icon svg {
    width: 18px;
    height: 18px;
}

.detail-card-title {
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
}

.detail-card-content {
    font-size: 12px;
    color: #a0aec0;
    line-height: 1.5;
}

.indicator-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.indicator-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.indicator-item:last-child {
    border-bottom: none;
}

.indicator-bullet {
    width: 6px;
    height: 6px;
    background: #e74c3c;
    border-radius: 50%;
    margin-top: 5px;
    flex-shrink: 0;
}

.indicator-text {
    font-size: 12px;
    color: #a0aec0;
}

.indicator-value {
    font-size: 11px;
    color: #718096;
    font-family: 'JetBrains Mono', monospace;
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: 4px;
    word-break: break-all;
}

/* Minimized state */
.agent-detection-banner.minimized .banner-content {
    padding: 8px 24px;
}

.agent-detection-banner.minimized .threat-icon {
    width: 32px;
    height: 32px;
}

.agent-detection-banner.minimized .threat-icon svg {
    width: 18px;
    height: 18px;
}

.agent-detection-banner.minimized .banner-subtitle {
    display: none;
}

/* Mobile responsive */
@media (max-width: 768px) {
    .banner-content {
        flex-wrap: wrap;
        padding: 12px 16px;
    }
    
    .banner-center {
        order: 3;
        width: 100%;
        justify-content: flex-start;
        margin-top: 8px;
    }
    
    .banner-right {
        margin-left: auto;
    }
    
    .details-grid {
        grid-template-columns: 1fr;
    }
}
`;

// SVG Icons
const ICONS = {
    shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M12 8v4M12 16h.01"/>
    </svg>`,
    bot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2"/>
        <circle cx="12" cy="5" r="2"/>
        <path d="M12 7v4"/>
        <line x1="8" y1="16" x2="8" y2="16"/>
        <line x1="16" y1="16" x2="16" y2="16"/>
    </svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`,
    chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
    </svg>`,
    fingerprint: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/>
        <path d="M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2"/>
        <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/>
        <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
        <path d="M8.65 22c.21-.66.45-1.32.57-2"/>
        <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
        <path d="M2 16h.01"/>
        <path d="M21.8 16c.2-2 .131-5.354 0-6"/>
        <path d="M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2"/>
    </svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
    </svg>`
};

/**
 * AgentDetectionOverlay class
 * Manages the overlay UI for displaying detected AI agents
 */
export class AgentDetectionOverlay {
    constructor(options = {}) {
        this.options = {
            autoDismissMs: options.autoDismissMs || 0, // 0 = no auto dismiss
            showDetails: options.showDetails !== false,
            position: options.position || 'top', // 'top' or 'bottom'
            onDismiss: options.onDismiss || null,
            ...options
        };
        
        this.detectedAgents = new Map();
        this.overlayElement = null;
        this.isVisible = false;
        this.isDetailsExpanded = false;
        this.stylesInjected = false;
        
        this._injectStyles();
        this._createOverlay();
        this._setupEventListeners();
    }
    
    /**
     * Inject CSS styles into the document
     */
    _injectStyles() {
        if (this.stylesInjected || document.getElementById('agent-detection-overlay-styles')) {
            return;
        }
        
        const styleElement = document.createElement('style');
        styleElement.id = 'agent-detection-overlay-styles';
        styleElement.textContent = OVERLAY_STYLES;
        document.head.appendChild(styleElement);
        this.stylesInjected = true;
    }
    
    /**
     * Create the overlay DOM structure
     */
    _createOverlay() {
        if (this.overlayElement) return;
        
        this.overlayElement = document.createElement('div');
        this.overlayElement.className = 'agent-detection-overlay';
        this.overlayElement.innerHTML = `
            <div class="agent-detection-banner">
                <div class="banner-content">
                    <div class="banner-left">
                        <div class="threat-icon">${ICONS.shield}</div>
                        <div class="banner-text">
                            <div class="banner-title">
                                <span class="status-dot"></span>
                                <span>AI Agent Detected</span>
                            </div>
                            <div class="banner-subtitle">Automated browser activity identified</div>
                        </div>
                    </div>
                    <div class="banner-center"></div>
                    <div class="banner-right">
                        <button class="details-btn" title="View detection details">
                            ${ICONS.info}
                            <span>Details</span>
                            ${ICONS.chevronDown}
                        </button>
                        <button class="dismiss-btn" title="Dismiss notification">
                            ${ICONS.close}
                        </button>
                    </div>
                </div>
                <div class="detection-details-panel">
                    <div class="details-content">
                        <div class="details-grid"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.overlayElement);
        
        // Cache DOM references
        this.bannerElement = this.overlayElement.querySelector('.agent-detection-banner');
        this.badgeContainer = this.overlayElement.querySelector('.banner-center');
        this.detailsPanel = this.overlayElement.querySelector('.detection-details-panel');
        this.detailsGrid = this.overlayElement.querySelector('.details-grid');
        this.detailsBtn = this.overlayElement.querySelector('.details-btn');
        this.dismissBtn = this.overlayElement.querySelector('.dismiss-btn');
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Details toggle
        this.detailsBtn?.addEventListener('click', () => this.toggleDetails());
        
        // Dismiss button
        this.dismissBtn?.addEventListener('click', () => this.dismiss());
        
        // Listen for global agent detection events
        window.addEventListener('agentDetected', (event) => {
            if (event.detail) {
                this.addDetection(event.detail);
            }
        });
    }
    
    /**
     * Add a new agent detection to the overlay
     * @param {Object} detection - Detection result object
     */
    addDetection(detection) {
        if (!detection || !detection.name || !detection.detected) return;
        
        // Store detection
        this.detectedAgents.set(detection.name, {
            ...detection,
            addedAt: Date.now()
        });
        
        // Update UI
        this._updateBadges();
        this._updateDetails();
        
        // Show overlay
        this.show();
        
        console.log(`🚨 Agent Detection Overlay: ${detection.name} added`, detection);
    }
    
    /**
     * Update the agent badges in the banner
     */
    _updateBadges() {
        if (!this.badgeContainer) return;
        
        this.badgeContainer.innerHTML = '';
        
        this.detectedAgents.forEach((detection, name) => {
            const badge = document.createElement('div');
            badge.className = 'agent-badge';
            badge.innerHTML = `
                <span class="agent-name">${name}</span>
                <span class="confidence">${Math.round(detection.confidence * 100)}%</span>
            `;
            badge.title = detection.detectionMethod || 'Agent detected';
            this.badgeContainer.appendChild(badge);
        });
        
        // Update title based on count
        const titleSpan = this.overlayElement.querySelector('.banner-title span:last-child');
        if (titleSpan) {
            const count = this.detectedAgents.size;
            titleSpan.textContent = count === 1 
                ? 'AI Agent Detected' 
                : `${count} AI Agents Detected`;
        }
    }
    
    /**
     * Update the details panel
     */
    _updateDetails() {
        if (!this.detailsGrid) return;
        
        this.detailsGrid.innerHTML = '';
        
        this.detectedAgents.forEach((detection, name) => {
            const card = document.createElement('div');
            card.className = 'detail-card';
            
            const indicatorsHtml = detection.indicators?.length > 0
                ? `<ul class="indicator-list">
                    ${detection.indicators.map(ind => `
                        <li class="indicator-item">
                            <span class="indicator-bullet"></span>
                            <div>
                                <div class="indicator-text">${ind.description || ind.name}</div>
                                ${ind.value ? `<div class="indicator-value">${typeof ind.value === 'object' ? JSON.stringify(ind.value) : ind.value}</div>` : ''}
                            </div>
                        </li>
                    `).join('')}
                </ul>`
                : '<p class="detail-card-content">No additional indicators</p>';
            
            card.innerHTML = `
                <div class="detail-card-header">
                    <div class="detail-card-icon">${ICONS.bot}</div>
                    <div class="detail-card-title">${name}</div>
                </div>
                <div class="detail-card-content">
                    <p style="margin-bottom: 8px; color: #cbd5e0;">
                        ${detection.detectionMethod || 'Detection method unknown'}
                    </p>
                    ${indicatorsHtml}
                </div>
            `;
            
            this.detailsGrid.appendChild(card);
        });
    }
    
    /**
     * Show the overlay
     */
    show() {
        if (this.isVisible) return;
        
        this.isVisible = true;
        
        // Force reflow before adding class
        this.bannerElement.offsetHeight;
        this.bannerElement.classList.add('visible');
        this.bannerElement.classList.remove('dismissed');
        
        // Auto dismiss if configured
        if (this.options.autoDismissMs > 0) {
            setTimeout(() => this.dismiss(), this.options.autoDismissMs);
        }
    }
    
    /**
     * Dismiss/hide the overlay
     */
    dismiss() {
        this.isVisible = false;
        this.bannerElement?.classList.remove('visible');
        this.bannerElement?.classList.add('dismissed');
        
        if (this.options.onDismiss) {
            this.options.onDismiss(Array.from(this.detectedAgents.values()));
        }
    }
    
    /**
     * Toggle the details panel
     */
    toggleDetails() {
        this.isDetailsExpanded = !this.isDetailsExpanded;
        this.detailsPanel?.classList.toggle('expanded', this.isDetailsExpanded);
        
        // Rotate chevron
        const chevron = this.detailsBtn?.querySelector('svg:last-child');
        if (chevron) {
            chevron.style.transform = this.isDetailsExpanded ? 'rotate(180deg)' : '';
        }
    }
    
    /**
     * Get all detected agents
     * @returns {Array} Array of detection objects
     */
    getDetectedAgents() {
        return Array.from(this.detectedAgents.values());
    }
    
    /**
     * Clear all detections
     */
    clear() {
        this.detectedAgents.clear();
        this._updateBadges();
        this._updateDetails();
        this.dismiss();
    }
    
    /**
     * Destroy the overlay
     */
    destroy() {
        this.overlayElement?.remove();
        this.overlayElement = null;
        this.isVisible = false;
    }
}

/**
 * Create and return a singleton instance
 * @param {Object} options - Configuration options
 * @returns {AgentDetectionOverlay} The overlay instance
 */
export function createAgentDetectionOverlay(options = {}) {
    // Return existing instance if available
    if (window.__agentDetectionOverlay) {
        return window.__agentDetectionOverlay;
    }
    
    const overlay = new AgentDetectionOverlay(options);
    window.__agentDetectionOverlay = overlay;
    
    return overlay;
}

// Export default
export default AgentDetectionOverlay;
