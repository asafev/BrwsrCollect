/**
 * Fingerprint UI - Alert Section Component
 * Renders suspicious indicators and behavioral anomalies
 */

import { IMPORTANCE_LEVELS } from '../config/constants.js';
import { formatPercentage } from '../utils/helpers.js';

/**
 * Create suspicious indicators alert section
 * @param {Array} indicators - Array of suspicious indicators
 * @param {object} summary - Summary statistics
 * @returns {HTMLElement|null} Alert section or null if no indicators
 */
export function createSuspiciousIndicatorsSection(indicators, summary) {
    // Don't render if no suspicious activity
    if (!summary?.hasSuspiciousActivity || !indicators?.length) {
        return null;
    }
    
    const section = document.createElement('div');
    section.className = 'fp-alert-section fp-alert-section--danger';
    
    // Header
    const header = document.createElement('div');
    header.className = 'fp-alert-header fp-alert-header--danger';
    header.innerHTML = `
        <div class="fp-alert-header__icon">🚨</div>
        <div class="fp-alert-header__content">
            <h3 class="fp-alert-header__title">Suspicious Browser Patterns Detected</h3>
            <p class="fp-alert-header__subtitle">Patterns that indicate sandbox environments or automation tools</p>
            <div class="fp-alert-stats">
                <div class="fp-alert-stat">
                    <span class="fp-alert-stat__value">${summary.totalIndicators || 0}</span>
                    <span class="fp-alert-stat__label">Total Indicators</span>
                </div>
                <div class="fp-alert-stat">
                    <span class="fp-alert-stat__value">${summary.riskCounts?.HIGH || 0}</span>
                    <span class="fp-alert-stat__label">High Risk</span>
                </div>
                <div class="fp-alert-stat">
                    <span class="fp-alert-stat__value">${formatPercentage(summary.suspicionScore)}</span>
                    <span class="fp-alert-stat__label">Suspicion Score</span>
                </div>
            </div>
        </div>
    `;
    
    // Body with indicators
    const body = document.createElement('div');
    body.className = 'fp-alert-body';
    
    // Add reasoning if available
    if (summary.reasoning) {
        const reasoning = document.createElement('div');
        reasoning.style.cssText = `
            background: var(--fp-warning-50);
            border: 1px solid var(--fp-warning-200);
            padding: var(--fp-spacing-md);
            border-radius: var(--fp-radius-md);
            margin-bottom: var(--fp-spacing-md);
            font-size: 0.875rem;
            color: var(--fp-warning-700);
        `;
        reasoning.innerHTML = `
            <strong>Detection Reasoning:</strong> ${escapeHtml(summary.reasoning)}
            ${summary.totalDetectedIndicators > summary.totalIndicators 
                ? `<br><small style="opacity: 0.8;">Additional ${summary.totalDetectedIndicators - summary.totalIndicators} weak indicator(s) also detected.</small>` 
                : ''}
        `;
        body.appendChild(reasoning);
    }
    
    // Render each indicator
    indicators.forEach(indicator => {
        try {
            body.appendChild(createIndicatorItem(indicator));
        } catch (error) {
            console.error('Error rendering indicator:', indicator, error);
        }
    });
    
    section.appendChild(header);
    section.appendChild(body);
    
    return section;
}

/**
 * Create behavioral indicators alert section
 * @param {object} behavioralData - Behavioral indicators data
 * @returns {HTMLElement|null} Alert section or null if no detections
 */
export function createBehavioralIndicatorsSection(behavioralData) {
    if (!behavioralData || behavioralData.error) {
        return null;
    }
    
    // Extract detected indicators
    const detectedIndicators = Object.entries(behavioralData).filter(([key, data]) => {
        return data && data.value === true;
    });
    
    if (detectedIndicators.length === 0) {
        return null;
    }
    
    const maxConfidence = behavioralData.maxConfidence?.value || 0;
    const riskLevel = behavioralData.riskLevel?.value || 'None';
    
    const section = document.createElement('div');
    const isHighRisk = riskLevel === 'HIGH' || riskLevel === 'MEDIUM';
    section.className = `fp-alert-section ${isHighRisk ? 'fp-alert-section--warning' : 'fp-alert-section--info'}`;
    
    // Header
    const header = document.createElement('div');
    header.className = `fp-alert-header ${isHighRisk ? 'fp-alert-header--warning' : 'fp-alert-header--info'}`;
    header.innerHTML = `
        <div class="fp-alert-header__icon">${isHighRisk ? '⚠️' : '🎯'}</div>
        <div class="fp-alert-header__content">
            <h3 class="fp-alert-header__title">${isHighRisk ? 'Behavioral Anomalies Detected' : 'Behavioral Patterns Detected'}</h3>
            <p class="fp-alert-header__subtitle">${isHighRisk ? 'Suspicious interaction patterns detected during testing' : 'Analysis of user interaction patterns'}</p>
            <div class="fp-alert-stats">
                <div class="fp-alert-stat">
                    <span class="fp-alert-stat__value">${detectedIndicators.length}</span>
                    <span class="fp-alert-stat__label">Detected Patterns</span>
                </div>
                <div class="fp-alert-stat">
                    <span class="fp-alert-stat__value">${formatPercentage(maxConfidence)}</span>
                    <span class="fp-alert-stat__label">Max Confidence</span>
                </div>
                <div class="fp-alert-stat">
                    <span class="fp-alert-stat__value">${riskLevel}</span>
                    <span class="fp-alert-stat__label">Risk Level</span>
                </div>
            </div>
        </div>
    `;
    
    // Body
    const body = document.createElement('div');
    body.className = 'fp-alert-body';
    
    // Session info
    if (behavioralData.sessionDuration?.value > 0) {
        const sessionInfo = document.createElement('div');
        sessionInfo.style.cssText = `
            background: var(--fp-info-50);
            border: 1px solid var(--fp-info-200);
            padding: var(--fp-spacing-md);
            border-radius: var(--fp-radius-md);
            margin-bottom: var(--fp-spacing-md);
        `;
        sessionInfo.innerHTML = `
            <div style="font-weight: 600; color: var(--fp-info-700); margin-bottom: var(--fp-spacing-xs);">📊 Session Information</div>
            <div style="font-size: 0.875rem; color: var(--fp-gray-600);">
                Duration: ${behavioralData.sessionDuration.value}s | 
                Total Events: ${behavioralData.totalEvents?.value || 0} | 
                ${behavioralData.summary?.value || 'No summary available'}
            </div>
        `;
        body.appendChild(sessionInfo);
    }
    
    // Render detected indicators
    const indicatorNames = {
        'centralButtonClicks': 'Central Button Clicks',
        'clicksWithoutMouseMovement': 'Clicks Without Mouse Movement',
        'nonHumanScrolling': 'Non-Human Scrolling',
        'artificialTiming': 'Artificial Timing Patterns',
        'missingMouseTrails': 'Missing Mouse Trails'
    };
    
    detectedIndicators
        .filter(([key]) => indicatorNames[key])
        .forEach(([key, data]) => {
            try {
                body.appendChild(createBehavioralItem(indicatorNames[key], data));
            } catch (error) {
                console.error('Error rendering behavioral indicator:', key, error);
            }
        });
    
    section.appendChild(header);
    section.appendChild(body);
    
    return section;
}

/**
 * Create a single indicator item
 * @param {object} indicator - Indicator data
 * @returns {HTMLElement} Indicator item element
 */
function createIndicatorItem(indicator) {
    const riskClass = (indicator.riskLevel || 'high').toLowerCase();
    const importance = IMPORTANCE_LEVELS[indicator.importance] || IMPORTANCE_LEVELS.WEAK;
    
    const item = document.createElement('article');
    item.className = `fp-alert-item fp-alert-item--${riskClass}`;
    item.setAttribute('role', 'article');
    item.setAttribute('aria-label', `${indicator.name}: ${riskClass} risk`);
    
    item.innerHTML = `
        <div class="fp-alert-item__icon" aria-hidden="true">${getRiskIcon(indicator.riskLevel)}</div>
        <div class="fp-alert-item__content">
            <div class="fp-alert-item__name">${escapeHtml(indicator.name)} <span aria-label="${importance.label}">${importance.icon}</span></div>
            <div class="fp-alert-item__description">${escapeHtml(indicator.description)}</div>
            <div class="fp-alert-item__meta">
                <span class="fp-alert-tag fp-alert-tag--primary">${escapeHtml(indicator.category)}</span>
                <span class="fp-alert-tag">Value: <code>${escapeHtml(String(indicator.value))}</code></span>
                <span class="fp-alert-tag">Confidence: ${formatPercentage(indicator.confidence)}</span>
                <span class="fp-alert-tag" style="background: ${importance.color}; color: white; border-color: ${importance.color};">
                    ${importance.label}
                </span>
            </div>
            ${indicator.details ? `
                <div style="margin-top: var(--fp-space-2, 0.5rem); font-size: var(--fp-font-size-200, 0.75rem); color: var(--fp-neutral-foreground-4, #707070);">
                    ${escapeHtml(indicator.details)}
                </div>
            ` : ''}
        </div>
    `;
    
    return item;
}

/**
 * Create a behavioral indicator item
 * @param {string} name - Display name
 * @param {object} data - Indicator data
 * @returns {HTMLElement} Behavioral item element
 */
function createBehavioralItem(name, data) {
    const item = document.createElement('article');
    item.className = 'fp-alert-item';
    item.setAttribute('role', 'article');
    item.setAttribute('aria-label', `${name}: behavioral anomaly detected`);
    
    const confidenceHigh = data.confidence > 0.7;
    const confidenceClass = confidenceHigh ? 'high-confidence' : '';
    
    item.innerHTML = `
        <div class="fp-alert-item__icon" aria-hidden="true">🎯</div>
        <div class="fp-alert-item__content">
            <div class="fp-alert-item__name">${escapeHtml(name)}</div>
            <div class="fp-alert-item__description">${escapeHtml(data.description || 'Behavioral anomaly detected during user interaction analysis')}</div>
            <div class="fp-alert-item__meta">
                <span class="fp-alert-tag">Count: <strong>${data.count || 0}</strong></span>
                <span class="fp-alert-tag">Threshold: ${data.threshold || 0}</span>
                <span class="fp-alert-tag ${confidenceClass}" style="${confidenceHigh ? 'background: var(--fp-status-danger-background, #FDE7E9); color: var(--fp-status-danger-foreground, #B10E1C); border-color: var(--fp-status-danger-border, #F7A6AD);' : ''}">
                    Confidence: ${formatPercentage(data.confidence)}
                </span>
                <span class="fp-alert-tag" style="background: var(--fp-status-danger-background, #FDE7E9); color: var(--fp-status-danger-foreground, #B10E1C); border-color: var(--fp-status-danger-border, #F7A6AD); font-weight: 600;">
                    ⚡ DETECTED
                </span>
            </div>
            ${data.details?.length ? `
                <details style="margin-top: var(--fp-space-3, 0.75rem);">
                    <summary style="cursor: pointer; color: var(--fp-brand-primary, #0F6CBD); font-size: var(--fp-font-size-300, 0.8125rem); font-weight: 500;">
                        View Details (${data.details.length} samples)
                    </summary>
                    <div style="margin-top: var(--fp-space-2, 0.5rem); font-size: var(--fp-font-size-200, 0.75rem);">
                        ${data.details.slice(0, 3).map(detail => `
                            <div style="background: var(--fp-neutral-background-3, #F5F5F5); padding: var(--fp-space-2, 0.5rem); margin: var(--fp-space-1, 0.25rem) 0; border-radius: var(--fp-radius-md, 4px); font-family: var(--fp-font-family-mono, monospace);">
                                ${escapeHtml(JSON.stringify(detail, null, 2).substring(0, 150))}...
                            </div>
                        `).join('')}
                    </div>
                </details>
            ` : ''}
        </div>
    `;
    
    return item;
}

/**
 * Get risk icon based on severity
 * @param {string} riskLevel - Risk level
 * @returns {string} Icon emoji
 */
function getRiskIcon(riskLevel) {
    switch (String(riskLevel).toUpperCase()) {
        case 'HIGH': return '�';
        case 'MEDIUM': return '🟡';
        case 'LOW': return '�';
        default: return '○';
    }
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
