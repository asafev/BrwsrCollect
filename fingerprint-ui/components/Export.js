/**
 * Fingerprint UI - Export Functionality
 * Export fingerprint data to JSON or CSV formats
 */

/**
 * Create export controls bar
 * @param {Function} onExport - Export callback function(format)
 * @returns {HTMLElement} Export bar element
 */
export function createExportBar(onExport) {
    const bar = document.createElement('div');
    bar.className = 'fp-export-bar';
    
    bar.innerHTML = `
        <button class="fp-export-btn" data-format="json">
            <span>📄</span>
            <span>Export JSON</span>
        </button>
        <button class="fp-export-btn fp-export-btn--secondary" data-format="csv">
            <span>📊</span>
            <span>Export CSV</span>
        </button>
        <button class="fp-export-btn" id="fp-expand-all" style="background: linear-gradient(135deg, var(--fp-gray-600), var(--fp-gray-700));">
            <span>📂</span>
            <span>Expand All</span>
        </button>
        <button class="fp-export-btn" id="fp-collapse-all" style="background: linear-gradient(135deg, var(--fp-gray-500), var(--fp-gray-600));">
            <span>📁</span>
            <span>Collapse All</span>
        </button>
    `;
    
    // Add event listeners for export buttons
    bar.querySelectorAll('[data-format]').forEach(btn => {
        btn.addEventListener('click', () => {
            const format = btn.dataset.format;
            if (onExport) onExport(format);
        });
    });
    
    return bar;
}

/**
 * Export fingerprint data to specified format
 * @param {object} data - Fingerprint data
 * @param {string} format - Export format ('json' or 'csv')
 */
export function exportFingerprintData(data, format) {
    if (!data) {
        console.error('No fingerprint data available for export');
        alert('No fingerprint data available for export');
        return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `browser-fingerprint-${timestamp}`;
    
    try {
        if (format === 'json') {
            const dataStr = JSON.stringify(data, null, 2);
            downloadFile(dataStr, `${filename}.json`, 'application/json');
        } else if (format === 'csv') {
            const csvData = convertToCSV(data.metrics);
            downloadFile(csvData, `${filename}.csv`, 'text/csv');
        }
    } catch (error) {
        console.error('Export failed:', error);
        alert(`Export failed: ${error.message}`);
    }
}

/**
 * Convert metrics to CSV format
 * @param {object} metrics - Metrics object
 * @returns {string} CSV string
 */
function convertToCSV(metrics) {
    const rows = [['Category', 'Metric', 'Value', 'Description', 'Risk Level']];
    
    for (const [category, categoryMetrics] of Object.entries(metrics)) {
        for (const [metric, data] of Object.entries(categoryMetrics)) {
            try {
                const value = data?.value !== undefined ? data.value : data;
                const description = data?.description || '';
                const risk = data?.risk || 'N/A';
                
                rows.push([
                    category,
                    metric,
                    String(value),
                    description,
                    risk
                ]);
            } catch (error) {
                console.warn(`Error processing metric ${metric}:`, error);
                rows.push([category, metric, 'Error', 'Failed to process', 'N/A']);
            }
        }
    }
    
    return rows.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
}

/**
 * Download a file to the user's device
 * @param {string} content - File content
 * @param {string} filename - File name
 * @param {string} contentType - MIME type
 */
function downloadFile(content, filename, contentType) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}
