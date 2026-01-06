/**
 * Fingerprint UI - Components Index
 * Re-exports all UI components for easy importing
 */

export { createSection, createSectionManager } from './Section.js';
export { createMetricsTable, setRawResults } from './MetricsTable.js';
export { createSummaryCards, updateSummaryCards } from './SummaryCards.js';
export { 
    createSuspiciousIndicatorsSection, 
    createBehavioralIndicatorsSection,
    createFakeDevicesSection,
    createKnownAgentsSection,
    updateKnownAgentsSection
} from './AlertSection.js';
export { createLoadingState, createBehavioralLoadingState, updateLoadingProgress, updateBehavioralStats, updateLoadingContent, createErrorState } from './Loading.js';
export { createExportBar, exportFingerprintData } from './Export.js';
export { showDetailModal, hideDetailModal } from './DetailModal.js';
export { FingerprintConsole, createFingerprintConsole } from './Console.js';

// Diff View Components
export { 
    createDiffToggleBar, 
    createDiffMetricsTable, 
    createDiffSection, 
    createNoDifferencesState, 
    createDiffOverviewCard,
    updateDiffSummary,
    getDiffConfig
} from './DiffView.js';

// Search and Customization Components
export { createSearchBar, createSearchFilter } from './SearchBar.js';
export { createMetricsCustomizer } from './MetricsCustomizer.js';

// Agent Detection Overlay
export { AgentDetectionOverlay } from './AgentDetectionOverlay.js';