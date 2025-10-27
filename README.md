# AI-Agent Behavioral Lab

A lightweight, self-contained HTML + vanilla JS lab for testing AI agents and capturing behavioral telemetry.

## Files

- **index.html** - Main UI with 4 panels: Intro/Controls, Task Runner, Live Telemetry, Report
- **styles.css** - Minimal, clean layout with responsive grid
- **lab.js** - Main controller orchestrating test flow and telemetry collection
- **report.js** - Metrics computation, Chart.js visualizations, and export functionality
- **fingerprint.js** - Browser fingerprinting without external APIs
- **sample-data.json** - Example of the exported JSON data structure

## Quick Start

1. Open `index.html` in any modern browser
2. Click "Start Test" to begin the 6-step behavioral protocol
3. Complete all steps in sequence (each has minimum dwell times)
4. Click "Generate Report" when prompted
5. Click "Export Report" to download JSON, CSV, and PNG files

## Test Protocol

The agent must complete these steps in order:

1. **Landing**: Wait 800-1200ms, click "Start Test"
2. **Form**: Type `agent@lab.test`, select "Scenario B", click "Continue"
3. **Navigation**: Open modal, then close it (X, backdrop, or Escape)
4. **Table**: Click "Sort by Name", then "Sort by Date", then click row #3
5. **Scrolling**: Scroll to bottom, top, then 50% (pause 500ms each)
6. **Finish**: Click "Generate Report", then "Export Report"

## Captured Telemetry

### High-Resolution Events
- Mouse/pointer movements with timestamps, coordinates, movement deltas
- Click events with target element identification
- Scroll events with velocity calculation
- Keyboard events (timing only, no content)
- DOM selector usage patterns (categorized, not logged verbatim)

### Browser Fingerprint
- Navigator properties (UA, platform, languages, webdriver flag)
- Screen dimensions and color depth
- WebGL vendor/renderer information
- Canvas fingerprint hash
- Storage capabilities and permissions
- Internationalization settings

### Derived Metrics
- Mouse path length, speed, curvature, straightness ratio
- Inter-click interval histogram and statistics
- Scroll velocity profiles and pause detection
- Typing cadence analysis
- Selector usage pattern distribution
- Heuristic behavioral flags

## Heuristic Flags

The system computes several behavioral indicators:

- **possible_programmatic_mouse**: High straight segments, low jitter, low isTrusted ratio
- **playwrightish_selector_usage**: High use of ARIA/role or text-based selectors
- **humanlike_scroll**: Multi-phase velocity with micro-pauses vs single jumps
- **robotic_clicking**: Very fast, consistent click intervals
- **synthetic_typing**: Paste detection or extremely fast typing

## Export Formats

- **JSON**: Complete raw events + derived metrics
- **CSV**: Key metrics + histogram data
- **PNG**: Mouse path visualization

## Programming Interface

### Global Methods
```javascript
// Reset lab state
LAB.reset()

// Get all collected data
LAB.getData()

// Optional callback for external harnesses
window.__LAB_ON_DONE__ = function(data) {
  console.log('Test completed:', data);
}
```

### Adding/Modifying Steps

Edit the `steps` array in `lab.js`:

```javascript
this.steps = [
  { name: 'StepName', minDwell: 1000, maxDwell: 5000, validator: () => this.validateStep() }
];
```

### Selector Usage Monitoring

The lab wraps `querySelector`/`querySelectorAll` to categorize usage:
- **id**: `#elementId`
- **class**: `.className`
- **aria_role**: `[role=button]`, `[aria-label]`
- **text_like**: Contains quotes or text-matching patterns
- **nth**: `:nth-child()`, `:first-child`, etc.

Only pattern buckets are logged, never actual selector strings.

## Browser Compatibility

- Modern browsers with ES6 module support
- Chart.js loaded via CDN
- No build tools required
- Runs entirely client-side

## Privacy Notes

- No actual typed content is logged (only keystroke timing)
- Selector patterns are categorized, not logged verbatim
- No external network calls except Chart.js CDN
- All data stays local until user explicitly exports

## Developer Notes

The lab is designed to be deterministic and fair across different agent types:
- Minimum dwell times prevent rushing through steps
- Visual timers show when actions are allowed
- Step validation ensures proper completion
- UI remains accessible to both humans and automation

Each component is modular and can be extended independently.
