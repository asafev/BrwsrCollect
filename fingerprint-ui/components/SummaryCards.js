/**
 * Fingerprint UI - Summary Cards Component
 * KPI dashboard cards for overview statistics
 */

/**
 * Create summary cards section
 * @param {object} summary - Summary data
 * @returns {HTMLElement} Summary cards container
 */
export function createSummaryCards(summary) {
    const container = document.createElement('div');
    container.className = 'fp-summary-grid';
    
    const cards = [
        {
            label: 'Total Metrics',
            value: summary.totalMetrics || 0,
            description: 'Browser characteristics analyzed',
            icon: '📊',
            variant: 'info'
        },
        {
            label: 'Risk Level',
            value: summary.riskLevel || 'Unknown',
            description: 'Overall automation risk assessment',
            icon: getRiskIcon(summary.riskLevel),
            variant: getRiskVariant(summary.riskLevel)
        },
        {
            label: 'High Risk Indicators',
            value: summary.highRiskIndicators || 0,
            description: 'Critical automation indicators',
            icon: '🚨',
            variant: summary.highRiskIndicators > 0 ? 'danger' : 'success'
        },
        {
            label: 'Automation Likelihood',
            value: summary.automationLikelihood || 'Unknown',
            description: 'Probability of automated browsing',
            icon: '🤖',
            variant: getAutomationVariant(summary.automationLikelihood)
        }
    ];
    
    cards.forEach(card => {
        container.appendChild(createSummaryCard(card));
    });
    
    return container;
}

/**
 * Create a single summary card
 * @param {object} options - Card options
 * @returns {HTMLElement} Card element
 */
function createSummaryCard({ label, value, description, icon, variant }) {
    const card = document.createElement('div');
    card.className = `fp-summary-card fp-summary-card--${variant}`;
    
    card.innerHTML = `
        <div class="fp-summary-card__header">
            <span class="fp-summary-card__label">${escapeHtml(label)}</span>
            <div class="fp-summary-card__icon">${icon}</div>
        </div>
        <div class="fp-summary-card__value">${escapeHtml(String(value))}</div>
        <div class="fp-summary-card__description">${escapeHtml(description)}</div>
    `;
    
    return card;
}

/**
 * Update summary cards with new data
 * @param {HTMLElement} container - Container element
 * @param {object} summary - New summary data
 */
export function updateSummaryCards(container, summary) {
    // Clear and recreate
    container.innerHTML = '';
    const newCards = createSummaryCards(summary);
    container.innerHTML = newCards.innerHTML;
}

/**
 * Get risk icon based on level
 * @param {string} riskLevel - Risk level
 * @returns {string} Icon emoji
 */
function getRiskIcon(riskLevel) {
    const level = String(riskLevel).toLowerCase();
    switch (level) {
        case 'high': return '🚨';
        case 'medium': return '⚠️';
        case 'low': return '✅';
        default: return '❓';
    }
}

/**
 * Get variant based on risk level
 * @param {string} riskLevel - Risk level
 * @returns {string} Variant name
 */
function getRiskVariant(riskLevel) {
    const level = String(riskLevel).toLowerCase();
    switch (level) {
        case 'high': return 'danger';
        case 'medium': return 'warning';
        case 'low': return 'success';
        default: return 'info';
    }
}

/**
 * Get variant based on automation likelihood
 * @param {string} likelihood - Automation likelihood
 * @returns {string} Variant name
 */
function getAutomationVariant(likelihood) {
    const level = String(likelihood).toLowerCase();
    if (level.includes('high') || level.includes('likely')) return 'danger';
    if (level.includes('medium') || level.includes('possible')) return 'warning';
    if (level.includes('low') || level.includes('unlikely')) return 'success';
    return 'info';
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
