/**
 * Fingerprint UI - Main Renderer
 * Orchestrates the rendering of all fingerprint analysis UI components
 */

import { 
    createSection, 
    createSectionManager,
    createMetricsTable,
    setRawResults,
    createSummaryCards,
    createSuspiciousIndicatorsSection,
    createBehavioralIndicatorsSection,
    createExportBar,
    exportFingerprintData
} from './components/index.js';

import { sortCategories } from './utils/helpers.js';
import { TELEMETRY_DESCRIPTIONS } from './config/constants.js';

/**
 * Main UI Renderer class
 * Manages the rendering of the fingerprint analysis page
 */
export class FingerprintUIRenderer {
    constructor(container) {
        this.container = container;
        this.sectionManager = createSectionManager();
        this.fingerprintData = null;
    }
    
    /**
     * Render the complete fingerprint analysis UI
     * @param {object} data - Fingerprint analysis data
     */
    render(data) {
        this.fingerprintData = data;
        this.container.innerHTML = '';
        
        // Set raw results for detail drill-downs
        if (data.rawResults) {
            setRawResults(data.rawResults);
        }
        
        try {
            // Render header
            this.container.appendChild(this.createHeader());
            
            // Render summary cards
            if (data.summary) {
                this.container.appendChild(createSummaryCards(data.summary));
            }
            
            // Render suspicious indicators alert (if any)
            if (data.suspiciousIndicators && data.suspiciousSummary) {
                const alertSection = createSuspiciousIndicatorsSection(
                    data.suspiciousIndicators, 
                    data.suspiciousSummary
                );
                if (alertSection) {
                    this.container.appendChild(alertSection);
                }
            }
            
            // Render behavioral indicators alert (if any)
            if (data.metrics?.behavioralIndicators) {
                const behavioralSection = createBehavioralIndicatorsSection(
                    data.metrics.behavioralIndicators
                );
                if (behavioralSection) {
                    this.container.appendChild(behavioralSection);
                }
            }
            
            // Render export controls
            const exportBar = createExportBar((format) => {
                exportFingerprintData(this.fingerprintData, format);
            });
            
            // Add expand/collapse all handlers
            const expandBtn = exportBar.querySelector('#fp-expand-all');
            const collapseBtn = exportBar.querySelector('#fp-collapse-all');
            
            if (expandBtn) {
                expandBtn.addEventListener('click', () => this.sectionManager.expandAll());
            }
            if (collapseBtn) {
                collapseBtn.addEventListener('click', () => this.sectionManager.collapseAll());
            }
            
            this.container.appendChild(exportBar);
            
            // Render metric sections
            if (data.metrics) {
                const sectionsContainer = document.createElement('div');
                sectionsContainer.className = 'fp-sections-container';
                
                const categories = sortCategories(Object.keys(data.metrics));
                
                categories.forEach((categoryKey, index) => {
                    try {
                        const categoryMetrics = data.metrics[categoryKey];
                        if (!categoryMetrics || typeof categoryMetrics !== 'object') {
                            console.warn(`Skipping invalid category: ${categoryKey}`);
                            return;
                        }
                        
                        const metricCount = Object.keys(categoryMetrics).length;
                        if (metricCount === 0) return;
                        
                        // Create metrics table for this category
                        const table = createMetricsTable(categoryMetrics, categoryKey);
                        
                        // Create expandable section
                        // Expand first 3 sections by default, or important ones
                        const importantCategories = ['automation', 'aiAgentDetection', 'behavioralIndicators', 'security'];
                        const isExpanded = index < 2 || importantCategories.includes(categoryKey);
                        
                        const section = createSection({
                            categoryKey,
                            metricCount,
                            content: table,
                            expanded: isExpanded
                        });
                        
                        this.sectionManager.register(categoryKey, section);
                        sectionsContainer.appendChild(section);
                        
                    } catch (error) {
                        console.error(`Error rendering category "${categoryKey}":`, error);
                        sectionsContainer.appendChild(this.createErrorSection(categoryKey, error));
                    }
                });
                
                this.container.appendChild(sectionsContainer);
            }
            
            // Render footer
            this.container.appendChild(this.createFooter());
            
        } catch (error) {
            console.error('Error rendering fingerprint UI:', error);
            this.container.innerHTML = '';
            this.container.appendChild(this.createGlobalError(error));
        }
    }
    
    /**
     * Create page header
     * @returns {HTMLElement} Header element
     */
    createHeader() {
        const header = document.createElement('header');
        header.className = 'fp-header';
        
        const now = new Date();
        
        header.innerHTML = `
            <h1 class="fp-header__title">
                <span class="fp-header__title-icon">🔍</span>
                Browser Fingerprint Analysis
            </h1>
            <p class="fp-header__subtitle">
                Comprehensive browser characteristics and automation detection metrics. 
                This analysis examines over 100 data points to identify browser fingerprinting signals.
            </p>
            <div class="fp-header__meta">
                <div class="fp-header__meta-item">
                    <span>📅</span>
                    <span>${now.toLocaleDateString()}</span>
                </div>
                <div class="fp-header__meta-item">
                    <span>🕐</span>
                    <span>${now.toLocaleTimeString()}</span>
                </div>
                <div class="fp-header__meta-item">
                    <span>🌐</span>
                    <span>${window.location.hostname}</span>
                </div>
            </div>
        `;
        
        return header;
    }
    
    /**
     * Create page footer
     * @returns {HTMLElement} Footer element
     */
    createFooter() {
        const footer = document.createElement('footer');
        footer.style.cssText = `
            text-align: center;
            padding: var(--fp-spacing-xl);
            color: var(--fp-gray-400);
            font-size: 0.875rem;
        `;
        
        footer.innerHTML = `
            <p>Browser Fingerprint Analysis Tool • Generated on ${new Date().toISOString()}</p>
        `;
        
        return footer;
    }
    
    /**
     * Create error section for failed category rendering
     * @param {string} categoryKey - The category that failed
     * @param {Error} error - The error
     * @returns {HTMLElement} Error section element
     */
    createErrorSection(categoryKey, error) {
        const section = document.createElement('div');
        section.className = 'fp-section';
        section.style.borderColor = 'var(--fp-danger-200)';
        
        section.innerHTML = `
            <div class="fp-section__header" style="background: var(--fp-danger-50);">
                <div class="fp-section__icon" style="background: var(--fp-danger-100);">❌</div>
                <div class="fp-section__title-group">
                    <h3 class="fp-section__title" style="color: var(--fp-danger-700);">
                        Error: ${categoryKey}
                    </h3>
                    <p class="fp-section__subtitle" style="color: var(--fp-danger-600);">
                        Failed to render this section: ${error.message}
                    </p>
                </div>
            </div>
        `;
        
        return section;
    }
    
    /**
     * Create global error state
     * @param {Error} error - The error
     * @returns {HTMLElement} Error element
     */
    createGlobalError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fp-error';
        
        errorDiv.innerHTML = `
            <div class="fp-error__icon">❌</div>
            <h3 class="fp-error__title">Rendering Failed</h3>
            <p class="fp-error__message">
                An error occurred while rendering the fingerprint analysis: ${error.message}
            </p>
            <pre style="margin-top: var(--fp-spacing-md); font-size: 0.75rem; text-align: left; max-width: 600px; overflow: auto; background: var(--fp-gray-100); padding: var(--fp-spacing-md); border-radius: var(--fp-radius-md);">
${error.stack || 'No stack trace available'}
            </pre>
        `;
        
        return errorDiv;
    }
    
    /**
     * Get the section manager for external control
     * @returns {object} Section manager
     */
    getSectionManager() {
        return this.sectionManager;
    }
}

/**
 * Helper to get telemetry description
 * Used for behavioral telemetry metrics
 * @param {string} key - Telemetry metric key
 * @returns {string} Description
 */
export function getTelemetryDescription(key) {
    return TELEMETRY_DESCRIPTIONS[key] || 'Behavioral telemetry metric';
}
