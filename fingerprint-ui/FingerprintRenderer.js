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
    exportFingerprintData,
    createDiffToggleBar,
    createDiffSection,
    createDiffOverviewCard,
    createNoDifferencesState,
    updateDiffSummary
} from './components/index.js';

import { sortCategories } from './utils/helpers.js';
import { BaselineComparator } from './utils/BaselineComparator.js';
import { TELEMETRY_DESCRIPTIONS } from './config/constants.js';

/**
 * Main UI Renderer class
 * Manages the rendering of the fingerprint analysis page
 */
export class FingerprintUIRenderer {
    constructor(container, options = {}) {
        this.container = container;
        this.sectionManager = createSectionManager();
        this.fingerprintData = null;
        this.diffMode = options.diffModeDefault || false;
        this.baselineComparator = null;
        this.comparisonResult = null;
        this.baselinePath = options.baselinePath || './fp_base/browser-fingerprint-chrome-trivial.json';
        
        // Store references for re-rendering
        this.sectionsContainer = null;
        this.diffToggleBar = null;
        this.diffOverviewCard = null;
    }
    
    /**
     * Initialize baseline comparator
     * @returns {Promise<boolean>} True if baseline loaded successfully
     */
    async initBaseline() {
        try {
            this.baselineComparator = new BaselineComparator();
            const loaded = await this.baselineComparator.loadBaseline(this.baselinePath);
            if (loaded) {
                console.log('✅ Baseline comparator initialized');
            }
            return loaded;
        } catch (error) {
            console.warn('⚠️ Failed to initialize baseline comparator:', error);
            return false;
        }
    }
    
    /**
     * Render the complete fingerprint analysis UI
     * @param {object} data - Fingerprint analysis data
     */
    async render(data) {
        this.fingerprintData = data;
        this.container.innerHTML = '';
        
        console.log('🎨 Rendering fingerprint UI, diffMode:', this.diffMode);
        
        // Set raw results for detail drill-downs
        if (data.rawResults) {
            setRawResults(data.rawResults);
        }
        
        // Initialize baseline comparator if not already done
        if (!this.baselineComparator) {
            console.log('📥 Initializing baseline comparator...');
            await this.initBaseline();
        }
        
        // Perform comparison if baseline is available
        if (this.baselineComparator?.isLoaded()) {
            try {
                this.comparisonResult = this.baselineComparator.compare(data);
                console.log('📊 Comparison result:', this.comparisonResult.summary);
            } catch (error) {
                console.warn('⚠️ Comparison failed:', error);
                this.comparisonResult = null;
            }
        } else {
            console.warn('⚠️ Baseline not loaded, comparison not available');
        }
        
        try {
            // Render header
            this.container.appendChild(this.createHeader());
            
            // Render summary cards
            if (data.summary) {
                this.container.appendChild(createSummaryCards(data.summary));
            }
            
            // Render diff toggle bar (if baseline available)
            if (this.comparisonResult) {
                this.diffToggleBar = createDiffToggleBar({
                    enabled: this.diffMode,
                    onChange: (enabled) => this.handleDiffModeChange(enabled),
                    summary: this.comparisonResult.summary,
                    baselineInfo: this.baselineComparator.getBaselineInfo()
                });
                this.container.appendChild(this.diffToggleBar);
            }
            
            // Render diff overview card (if in diff mode)
            if (this.diffMode && this.comparisonResult) {
                this.diffOverviewCard = createDiffOverviewCard(this.comparisonResult);
                this.container.appendChild(this.diffOverviewCard);
            }
            
            // Render suspicious indicators alert (if any and not in diff mode)
            if (!this.diffMode && data.suspiciousIndicators && data.suspiciousSummary) {
                const alertSection = createSuspiciousIndicatorsSection(
                    data.suspiciousIndicators, 
                    data.suspiciousSummary
                );
                if (alertSection) {
                    this.container.appendChild(alertSection);
                }
            }
            
            // Render behavioral indicators alert (if any and not in diff mode)
            if (!this.diffMode && data.metrics?.behavioralIndicators) {
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
            
            // Render sections based on mode
            this.sectionsContainer = document.createElement('div');
            this.sectionsContainer.className = 'fp-sections-container';
            
            if (this.diffMode && this.comparisonResult) {
                this.renderDiffSections();
            } else {
                this.renderNormalSections(data);
            }
            
            this.container.appendChild(this.sectionsContainer);
            
            // Render footer
            this.container.appendChild(this.createFooter());
            
        } catch (error) {
            console.error('Error rendering fingerprint UI:', error);
            this.container.innerHTML = '';
            this.container.appendChild(this.createGlobalError(error));
        }
    }
    
    /**
     * Handle diff mode toggle
     * @param {boolean} enabled - Whether diff mode is enabled
     */
    handleDiffModeChange(enabled) {
        this.diffMode = enabled;
        console.log(`🔄 Diff mode ${enabled ? 'enabled' : 'disabled'}`);
        console.log('📊 Current fingerprint data:', this.fingerprintData ? 'available' : 'null');
        console.log('📊 Comparison result:', this.comparisonResult ? 'available' : 'null');
        
        // Re-render the page with new mode
        this.render(this.fingerprintData).then(() => {
            console.log('✅ Re-render complete');
        }).catch(err => {
            console.error('❌ Re-render failed:', err);
        });
        
        // Scroll to top smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    /**
     * Render sections in normal mode (all metrics)
     * @param {object} data - Fingerprint data
     */
    renderNormalSections(data) {
        if (!data.metrics) return;
        
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
                this.sectionsContainer.appendChild(section);
                
            } catch (error) {
                console.error(`Error rendering category "${categoryKey}":`, error);
                this.sectionsContainer.appendChild(this.createErrorSection(categoryKey, error));
            }
        });
    }
    
    /**
     * Render sections in diff mode (only differences)
     */
    renderDiffSections() {
        if (!this.comparisonResult) {
            this.sectionsContainer.innerHTML = '<p>No comparison data available.</p>';
            return;
        }
        
        // Get only differences
        const differences = this.baselineComparator.getDifferences(this.comparisonResult, {
            includeMissing: true,
            includeNew: true,
            includeIgnored: false
        });
        
        const diffCategories = Object.keys(differences);
        
        // Check if there are any differences
        if (diffCategories.length === 0) {
            const emptyState = createNoDifferencesState();
            
            // Add handler to switch to full view
            const showAllBtn = emptyState.querySelector('#fp-show-all-metrics');
            if (showAllBtn) {
                showAllBtn.addEventListener('click', () => {
                    this.handleDiffModeChange(false);
                });
            }
            
            this.sectionsContainer.appendChild(emptyState);
            return;
        }
        
        // Sort categories
        const sortedCategories = sortCategories(diffCategories);
        
        sortedCategories.forEach((categoryKey) => {
            try {
                const categoryDiff = differences[categoryKey];
                
                const section = createDiffSection({
                    categoryKey,
                    categoryDiff,
                    expanded: true // Expand all in diff mode
                });
                
                this.sectionManager.register(categoryKey, section);
                this.sectionsContainer.appendChild(section);
                
            } catch (error) {
                console.error(`Error rendering diff category "${categoryKey}":`, error);
                this.sectionsContainer.appendChild(this.createErrorSection(categoryKey, error));
            }
        });
    }
    
    /**
     * Create page header
     * @returns {HTMLElement} Header element
     */
    createHeader() {
        const header = document.createElement('header');
        header.className = 'fp-header';
        header.setAttribute('role', 'banner');
        
        const now = new Date();
        const formattedDate = now.toLocaleDateString(undefined, { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
        const formattedTime = now.toLocaleTimeString(undefined, { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Calculate metrics summary for header
        const totalMetrics = this.fingerprintData?.summary?.totalMetrics || 0;
        const categoriesCount = Object.keys(this.fingerprintData?.metrics || {}).length;
        
        header.innerHTML = `
            <h1 class="fp-header__title">
                <span class="fp-header__title-icon" aria-hidden="true">🔍</span>
                Browser Fingerprint Analysis
            </h1>
            <p class="fp-header__subtitle">
                Enterprise security assessment analyzing ${totalMetrics.toLocaleString()} data points across ${categoriesCount} categories to identify browser characteristics, automation patterns, and security signals.
            </p>
            <div class="fp-header__meta">
                <div class="fp-header__meta-item">
                    <span aria-hidden="true">📅</span>
                    <span>${formattedDate}</span>
                </div>
                <div class="fp-header__meta-item">
                    <span aria-hidden="true">🕐</span>
                    <span>${formattedTime}</span>
                </div>
                <div class="fp-header__meta-item">
                    <span aria-hidden="true">🌐</span>
                    <span>${window.location.hostname || 'localhost'}</span>
                </div>
                <div class="fp-header__meta-item">
                    <span aria-hidden="true">📊</span>
                    <span>${totalMetrics} metrics</span>
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
        footer.className = 'fp-footer';
        footer.setAttribute('role', 'contentinfo');
        footer.style.cssText = `
            text-align: center;
            padding: var(--fp-space-6, 1.5rem);
            margin-top: var(--fp-space-6, 1.5rem);
            color: var(--fp-neutral-foreground-4, #707070);
            font-size: var(--fp-font-size-300, 0.8125rem);
            border-top: 1px solid var(--fp-neutral-stroke-3, #EBEBEB);
        `;
        
        const now = new Date();
        const timestamp = now.toISOString();
        const localTime = now.toLocaleString();
        
        footer.innerHTML = `
            <p style="margin: 0 0 var(--fp-space-2, 0.5rem) 0;">
                <strong>Browser Fingerprint Analysis</strong> • Enterprise Security Dashboard
            </p>
            <p style="margin: 0; font-size: var(--fp-font-size-200, 0.75rem);">
                Generated: ${localTime} (${timestamp})
            </p>
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
