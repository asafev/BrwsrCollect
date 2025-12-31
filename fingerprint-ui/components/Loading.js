/**
 * Fingerprint UI - Loading Component
 * Loading state with progress indicator and live stats
 */

/**
 * Create loading state component
 * @param {object} options - Loading options
 * @param {string} options.title - Loading title
 * @param {string} options.subtitle - Loading subtitle
 * @param {boolean} options.showProgress - Whether to show progress bar
 * @param {boolean} options.showStats - Whether to show live stats
 * @returns {HTMLElement} Loading element
 */
export function createLoadingState(options = {}) {
    const {
        title = 'Analyzing Browser Fingerprint...',
        subtitle = 'Collecting and processing browser characteristics',
        showProgress = true,
        showStats = false
    } = options;
    
    const container = document.createElement('div');
    container.className = 'fp-loading';
    container.id = 'fp-loading-state';
    
    container.innerHTML = `
        <div class="fp-loading__spinner"></div>
        <h3 class="fp-loading__title">${escapeHtml(title)}</h3>
        <p class="fp-loading__text">${escapeHtml(subtitle)}</p>
        ${showProgress ? `
            <div class="fp-loading__progress">
                <div class="fp-loading__progress-bar" id="fp-progress-bar" style="width: 0%;"></div>
            </div>
            <p class="fp-loading__text" id="fp-progress-text" style="margin-top: var(--fp-spacing-sm);"></p>
        ` : ''}
        ${showStats ? `
            <div class="fp-loading__stats">
                <div class="fp-loading__stat">
                    <div class="fp-loading__stat-value" id="fp-stat-mouse">0</div>
                    <div class="fp-loading__stat-label">Mouse Moves</div>
                </div>
                <div class="fp-loading__stat">
                    <div class="fp-loading__stat-value" id="fp-stat-clicks">0</div>
                    <div class="fp-loading__stat-label">Clicks</div>
                </div>
                <div class="fp-loading__stat">
                    <div class="fp-loading__stat-value" id="fp-stat-scrolls">0</div>
                    <div class="fp-loading__stat-label">Scrolls</div>
                </div>
            </div>
        ` : ''}
    `;
    
    return container;
}

/**
 * Create behavioral collection loading state
 * @returns {HTMLElement} Loading element
 */
export function createBehavioralLoadingState() {
    return createLoadingState({
        title: 'Collecting Behavioral Data...',
        subtitle: '🖱️ Please interact with the page! Move your mouse, click anywhere, scroll if possible.',
        showProgress: true,
        showStats: true
    });
}

/**
 * Update loading progress
 * @param {number} percentage - Progress percentage (0-100)
 * @param {string} text - Progress text
 */
export function updateLoadingProgress(percentage, text) {
    const progressBar = document.getElementById('fp-progress-bar');
    const progressText = document.getElementById('fp-progress-text');
    
    if (progressBar) {
        progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }
    
    if (progressText && text) {
        progressText.textContent = text;
    }
}

/**
 * Update behavioral stats during collection
 * @param {object} stats - Stats object with mouse, clicks, scrolls
 */
export function updateBehavioralStats(stats) {
    const mouseEl = document.getElementById('fp-stat-mouse');
    const clicksEl = document.getElementById('fp-stat-clicks');
    const scrollsEl = document.getElementById('fp-stat-scrolls');
    
    if (mouseEl) mouseEl.textContent = stats.mouseTrailLength || stats.mouse || 0;
    if (clicksEl) clicksEl.textContent = stats.clickHistoryLength || stats.clicks || 0;
    if (scrollsEl) scrollsEl.textContent = stats.scrollHistoryLength || stats.scrolls || 0;
}

/**
 * Update loading state content
 * @param {string} title - New title
 * @param {string} subtitle - New subtitle
 */
export function updateLoadingContent(title, subtitle) {
    const container = document.getElementById('fp-loading-state');
    if (!container) return;
    
    const titleEl = container.querySelector('.fp-loading__title');
    const subtitleEl = container.querySelector('.fp-loading__text');
    
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
}

/**
 * Create error state component
 * @param {Error|string} error - Error object or message
 * @returns {HTMLElement} Error element
 */
export function createErrorState(error) {
    const message = error instanceof Error ? error.message : String(error);
    
    const container = document.createElement('div');
    container.className = 'fp-error';
    
    container.innerHTML = `
        <div class="fp-error__icon">❌</div>
        <h3 class="fp-error__title">Analysis Failed</h3>
        <p class="fp-error__message">${escapeHtml(message)}</p>
    `;
    
    return container;
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
