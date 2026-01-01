/**
 * Fingerprint UI - Metrics Table Component
 * Renders metrics in a table format with error handling
 */

import { formatMetricName, formatValue, getJsCode, getRiskConfig, isImageDataUrl, createErrorElement } from '../utils/helpers.js';
import { showDetailModal } from './DetailModal.js';

// Map of metrics that have detailed drill-down data
const DETAIL_METRICS = {
    // Fonts category
    'fontsCount': { detailKey: 'fonts', detailType: 'fonts', title: 'Detected Fonts' },
    'fontHash': { detailKey: 'fonts', detailType: 'fonts', title: 'Detected Fonts' },
    'fontsApplicationsDetected': { detailKey: 'applications', detailType: 'applications', title: 'Detected Applications' },
    'fontsApplicationsList': { detailKey: 'applications', detailType: 'applications', title: 'Detected Applications' },
    'fontsEmojiSupported': { detailKey: 'emoji', detailType: 'emoji', title: 'Emoji Rendering Details' },
    'fontsEmojiAvgPixels': { detailKey: 'emoji', detailType: 'emoji', title: 'Emoji Rendering Details' },
    'fontsEmojiRunningHash': { detailKey: 'emoji', detailType: 'emoji', title: 'Emoji Rendering Details' },
    'fontsEmojiHash': { detailKey: 'emoji', detailType: 'emoji', title: 'Emoji Rendering Details' },
    'fontsPlatformOS': { detailKey: 'platform', detailType: 'json', title: 'Platform Detection Details' },
    'fontsPlatformVersion': { detailKey: 'platform', detailType: 'json', title: 'Platform Detection Details' },
    'fontsPlatformConfidence': { detailKey: 'platform', detailType: 'json', title: 'Platform Detection Details' },
};

// Store for raw result data (set externally)
let rawResultsStore = {};

/**
 * Set the raw results data for detail lookups
 * @param {object} results - The raw fingerprint results
 */
export function setRawResults(results) {
    rawResultsStore = results || {};
}

/**
 * Create a metrics table for a category
 * @param {object} metrics - The metrics object for this category
 * @param {string} categoryKey - The category key
 * @param {object} rawData - Optional raw data for this category (for details)
 * @returns {HTMLElement} Table element
 */
export function createMetricsTable(metrics, categoryKey, rawData = null) {
    // Store raw data if provided
    if (rawData) {
        rawResultsStore[categoryKey] = rawData;
    }
    
    // Create wrapper for responsive table
    const wrapper = document.createElement('div');
    wrapper.className = 'fp-table-wrapper';
    wrapper.style.cssText = 'overflow-x: auto; -webkit-overflow-scrolling: touch;';
    
    const table = document.createElement('table');
    table.className = 'fp-metrics-table';
    table.setAttribute('role', 'table');
    table.setAttribute('aria-label', `${categoryKey} metrics`);
    
    // Create header with improved accessibility
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr role="row">
            <th role="columnheader" scope="col" style="width: 44px; text-align: center;">#</th>
            <th role="columnheader" scope="col" style="width: 180px;">Metric Name</th>
            <th role="columnheader" scope="col" style="width: 220px;">Current Value</th>
            <th role="columnheader" scope="col" style="width: 240px;">Description</th>
            <th role="columnheader" scope="col" style="width: 200px;">API Reference</th>
            <th role="columnheader" scope="col" style="width: 90px; text-align: center;">Risk Level</th>
        </tr>
    `;
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    tbody.setAttribute('role', 'rowgroup');
    
    let index = 1;
    for (const [metricName, metricData] of Object.entries(metrics)) {
        try {
            const row = createMetricRow(index++, metricName, metricData, categoryKey);
            tbody.appendChild(row);
        } catch (error) {
            console.error(`Error rendering metric "${metricName}":`, error);
            const errorRow = createErrorRow(index++, metricName, error);
            tbody.appendChild(errorRow);
        }
    }
    
    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
}

/**
 * Create a single metric row
 * @param {number} index - Row number
 * @param {string} metricName - The metric name
 * @param {object} metricData - The metric data
 * @param {string} categoryKey - The category key
 * @returns {HTMLTableRowElement} Table row element
 */
function createMetricRow(index, metricName, metricData, categoryKey) {
    const row = document.createElement('tr');
    
    // Safely extract values with defaults
    const value = metricData?.value !== undefined ? metricData.value : metricData;
    const description = metricData?.description || 'No description available';
    const risk = metricData?.risk || 'N/A';
    
    const riskConfig = getRiskConfig(risk);
    
    // Number cell
    const numCell = document.createElement('td');
    numCell.style.textAlign = 'center';
    numCell.style.fontWeight = '600';
    numCell.style.color = 'var(--fp-gray-400)';
    numCell.style.fontFamily = 'var(--fp-font-mono)';
    numCell.textContent = index;
    
    // Name cell
    const nameCell = document.createElement('td');
    nameCell.innerHTML = `<span class="fp-metric-name">${formatMetricName(metricName)}</span>`;
    
    // Value cell
    const valueCell = document.createElement('td');
    valueCell.appendChild(createValueElement(value, metricName, categoryKey));
    
    // Description cell
    const descCell = document.createElement('td');
    descCell.innerHTML = `<span class="fp-metric-description">${escapeHtml(description)}</span>`;
    
    // JS Code cell
    const codeCell = document.createElement('td');
    const code = getJsCode(metricName, categoryKey);
    codeCell.innerHTML = `<code class="fp-metric-code">${escapeHtml(code)}</code>`;
    
    // Risk cell
    const riskCell = document.createElement('td');
    riskCell.innerHTML = `
        <span class="fp-risk-badge fp-risk-badge--${riskConfig.className}">
            ${riskConfig.icon} ${riskConfig.label}
        </span>
    `;
    
    row.appendChild(numCell);
    row.appendChild(nameCell);
    row.appendChild(valueCell);
    row.appendChild(descCell);
    row.appendChild(codeCell);
    row.appendChild(riskCell);
    
    return row;
}

/**
 * Create a value display element with special handling for images and clickable details
 * @param {any} value - The value to display
 * @param {string} metricName - The metric name
 * @param {string} categoryKey - The category key
 * @returns {HTMLElement} Value element
 */
function createValueElement(value, metricName, categoryKey) {
    // Handle image data URLs (WebGL screenshots)
    if (isImageDataUrl(value)) {
        const wrapper = document.createElement('div');
        const img = document.createElement('img');
        img.src = value;
        img.className = 'fp-metric-image';
        img.alt = `${metricName} visualization`;
        img.title = 'Click to view full size';
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => {
            window.open(value, '_blank');
        });
        wrapper.appendChild(img);
        return wrapper;
    }
    
    // Handle boolean values with color coding
    const span = document.createElement('span');
    span.className = 'fp-metric-value';
    
    if (typeof value === 'boolean') {
        span.classList.add(value ? 'fp-metric-value--success' : 'fp-metric-value--danger');
    }
    
    span.textContent = formatValue(value);
    span.title = String(value); // Full value on hover
    
    // Check if this metric has detailed data available
    const detailConfig = DETAIL_METRICS[metricName];
    if (detailConfig && rawResultsStore[categoryKey]) {
        const detailData = rawResultsStore[categoryKey][detailConfig.detailKey];
        if (detailData && (Array.isArray(detailData) ? detailData.length > 0 : detailData)) {
            span.classList.add('fp-metric-value--clickable');
            span.title = 'Click to view details';
            span.innerHTML = `${formatValue(value)} <span class="fp-detail-icon">🔍</span>`;
            span.addEventListener('click', () => {
                showDetailModal({
                    title: detailConfig.title,
                    metricName: metricName,
                    value: value,
                    details: detailData,
                    detailType: detailConfig.detailType
                });
            });
        }
    }
    
    return span;
}

/**
 * Create an error row for failed metric rendering
 * @param {number} index - Row number
 * @param {string} metricName - The metric name
 * @param {Error} error - The error
 * @returns {HTMLTableRowElement} Error row element
 */
function createErrorRow(index, metricName, error) {
    const row = document.createElement('tr');
    row.style.backgroundColor = 'var(--fp-danger-50)';
    
    const numCell = document.createElement('td');
    numCell.textContent = index;
    numCell.style.textAlign = 'center';
    
    const nameCell = document.createElement('td');
    nameCell.innerHTML = `<span class="fp-metric-name">${formatMetricName(metricName)}</span>`;
    
    const errorCell = document.createElement('td');
    errorCell.colSpan = 4;
    errorCell.appendChild(createErrorElement(metricName, error));
    
    row.appendChild(numCell);
    row.appendChild(nameCell);
    row.appendChild(errorCell);
    
    return row;
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
