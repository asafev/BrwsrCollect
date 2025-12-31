/**
 * Fingerprint UI - Section Component
 * Expandable section with header and content
 */

import { getCategoryConfig } from '../utils/helpers.js';

/**
 * Create an expandable section component
 * @param {object} options - Section options
 * @param {string} options.categoryKey - The category key
 * @param {number} options.metricCount - Number of metrics in section
 * @param {HTMLElement} options.content - The content element
 * @param {boolean} options.expanded - Initial expanded state
 * @returns {HTMLElement} Section element
 */
export function createSection({ categoryKey, metricCount, content, expanded = false }) {
    const config = getCategoryConfig(categoryKey);
    
    const section = document.createElement('div');
    section.className = `fp-section fp-section--${categoryKey}${expanded ? ' fp-section--expanded' : ''}`;
    section.dataset.category = categoryKey;
    
    // Create header
    const header = document.createElement('div');
    header.className = 'fp-section__header';
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    header.setAttribute('tabindex', '0');
    
    header.innerHTML = `
        <div class="fp-section__icon" aria-hidden="true">${config.icon}</div>
        <div class="fp-section__title-group">
            <h3 class="fp-section__title">${config.label}</h3>
            <p class="fp-section__subtitle">${config.description}</p>
        </div>
        <div class="fp-section__meta">
            <span class="fp-section__count" title="${metricCount} metrics">${metricCount}</span>
            <div class="fp-section__toggle">
                <svg class="fp-section__toggle-icon fp-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
        </div>
    `;
    
    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'fp-section__content';
    
    const contentInner = document.createElement('div');
    contentInner.className = 'fp-section__inner';
    contentInner.appendChild(content);
    
    contentWrapper.appendChild(contentInner);
    
    // Toggle functionality
    const toggleSection = () => {
        const isExpanded = section.classList.toggle('fp-section--expanded');
        header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    };
    
    header.addEventListener('click', toggleSection);
    header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleSection();
        }
    });
    
    section.appendChild(header);
    section.appendChild(contentWrapper);
    
    return section;
}

/**
 * Create the section manager to handle expand all/collapse all
 * @returns {object} Section manager with methods
 */
export function createSectionManager() {
    const sections = new Map();
    
    return {
        /**
         * Register a section
         * @param {string} categoryKey - The category key
         * @param {HTMLElement} element - The section element
         */
        register(categoryKey, element) {
            sections.set(categoryKey, element);
        },
        
        /**
         * Expand all sections
         */
        expandAll() {
            sections.forEach((element) => {
                element.classList.add('fp-section--expanded');
                const header = element.querySelector('.fp-section__header');
                if (header) header.setAttribute('aria-expanded', 'true');
            });
        },
        
        /**
         * Collapse all sections
         */
        collapseAll() {
            sections.forEach((element) => {
                element.classList.remove('fp-section--expanded');
                const header = element.querySelector('.fp-section__header');
                if (header) header.setAttribute('aria-expanded', 'false');
            });
        },
        
        /**
         * Toggle a specific section
         * @param {string} categoryKey - The category key
         */
        toggle(categoryKey) {
            const element = sections.get(categoryKey);
            if (element) {
                const isExpanded = element.classList.toggle('fp-section--expanded');
                const header = element.querySelector('.fp-section__header');
                if (header) header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
            }
        },
        
        /**
         * Get all registered sections
         * @returns {Map} Sections map
         */
        getSections() {
            return sections;
        }
    };
}
