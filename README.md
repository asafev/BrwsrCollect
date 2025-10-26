# AI Agent Detection Framework

A comprehensive web-based framework for detecting AI agents, DOM manipulations, and browser automation in real-time. This tool is designed for security research and analysis of AI agent behavior patterns.

## 🚀 Features

### Core Detection Capabilities
- **DOM Mutation Detection**: Real-time monitoring of DOM changes, detecting suspicious element injections and modifications
- **Extension Detection**: Identifies browser extensions and content scripts, particularly AI agents like Perplexity Comet
- **Stylesheet Monitoring**: Tracks CSS injections and modifications that may indicate automated behavior
- **Overlay Detection**: Detects high z-index elements and overlays commonly used by AI agents
- **Live Dashboard**: Real-time comprehensive analysis and reporting

### AI Agent Detection
Based on research from Castle.io and modern detection techniques, the framework can identify:
- **Perplexity Comet**: Specialized detection for Comet browser agent patterns
- **OpenAI Operator**: HTTP Message Signature detection and behavioral analysis
- **Browserbase**: Automation framework fingerprinting
- **Generic Automation**: WebDriver, Playwright, Puppeteer detection

### Detection Techniques
- High z-index element detection (>9999)
- Chrome extension injection monitoring
- Style override pattern recognition
- Mouse movement behavioral analysis
- Timezone and environment anomaly detection
- Canvas fingerprinting for server environments

## 📁 Project Structure

```
htmljsres/
├── index.html              # Main dashboard and overview
├── css/
│   └── style.css           # Shared styles and components
├── js/
│   └── ai-detector.js      # Core detection engine
├── pages/
│   ├── dom-monitor.html    # DOM mutation monitoring
│   ├── extension-detector.html  # Extension detection
│   ├── stylesheet-monitor.html  # CSS monitoring
│   ├── overlay-detector.html    # Overlay detection
│   └── live-dashboard.html      # Real-time dashboard
├── server.py               # Simple HTTP server for deployment
├── start.bat              # Windows startup script
├── start.sh               # Unix/Linux startup script
└── README.md              # This file
```

## 🏃‍♂️ Quick Start

### Option 1: Python HTTP Server (Recommended)
```bash
# Clone or download the project
cd htmljsres

# Python 3
python server.py

# Or Python 2
python -m SimpleHTTPServer 8080
```

### Option 2: Windows Batch Script
```cmd
# Double-click start.bat or run:
start.bat
```

### Option 3: Unix/Linux Shell Script
```bash
# Make executable and run:
chmod +x start.sh
./start.sh
```

### Option 4: Any Web Server
Simply serve the files from any web server (Apache, Nginx, etc.) as static content.

## 🌐 Access the Framework

After starting the server:
- Open your browser to `http://localhost:8080`
- Navigate through the different detection modules
- Start monitoring to begin real-time detection

## 📖 Usage Guide

### 1. Main Dashboard (`index.html`)
- Overview of all detection systems
- Quick start monitoring
- System status indicators
- Test detection capabilities

### 2. DOM Monitor (`pages/dom-monitor.html`)
- Real-time DOM mutation tracking
- Suspicious pattern detection
- Element injection analysis
- DOM tree visualization

### 3. Extension Detector (`pages/extension-detector.html`)
- Browser extension scanning
- Content script detection
- AI agent pattern matching
- Deep technical analysis

### 4. Stylesheet Monitor (`pages/stylesheet-monitor.html`)
- CSS injection tracking
- Style modification detection
- Suspicious rule analysis
- Baseline comparison

### 5. Overlay Detector (`pages/overlay-detector.html`)
- High z-index element detection
- Overlay pattern analysis
- Screen coverage mapping
- Perplexity Comet specific tests

### 6. Live Dashboard (`pages/live-dashboard.html`)
- Real-time monitoring feed
- Threat level assessment
- System health monitoring
- Comprehensive reporting

## 🧪 Testing the System

Each module includes built-in test functions:

### DOM Monitor Tests
- Test element injection
- Style modification simulation
- Overlay injection tests
- AI agent pattern injection

### Extension Detector Tests
- Content script simulation
- AI agent pattern testing
- DOM injection tests
- Global variable simulation

### Stylesheet Monitor Tests
- CSS injection simulation
- Style override tests
- Overlay CSS patterns
- Element hiding tests

### Overlay Detector Tests
- Fullscreen overlay simulation
- High z-index testing
- Transparent overlay detection
- AI agent overlay patterns

## 🔍 Detection Patterns

### Suspicious Indicators
- Elements with z-index > 9999
- Position fixed/absolute overlays covering >50% of screen
- Opacity manipulation (near-invisible interactive elements)
- AI agent specific IDs/classes (pplx-agent-overlay, comet-agent, etc.)
- Extension content script injections
- Automation framework globals (webdriver, playwright, puppeteer)

### AI Agent Signatures
- **Perplexity Comet**: Style overrides, specific overlay elements, browser protocol detection
- **OpenAI Operator**: HTTP message signatures, specific user agent patterns
- **Automation Tools**: WebDriver flags, CDP artifacts, timezone anomalies

## 📊 Export and Reporting

All modules support data export:
- JSON format reports
- Detection event logs
- System health snapshots
- Comprehensive analysis summaries

## 🛡️ Security Research Use Cases

- **Web Application Security**: Detect automated attacks and bot behavior
- **AI Agent Analysis**: Study AI agent behavior patterns and signatures
- **Browser Automation Detection**: Identify headless browsers and automation tools
- **Extension Security**: Monitor for malicious extension behavior
- **Overlay Attack Detection**: Identify UI redressing and clickjacking attempts

## 🔧 Technical Implementation

### Core Technologies
- Pure JavaScript (ES6+)
- HTML5 with responsive design
- CSS3 with modern features
- MutationObserver API for DOM monitoring
- Web APIs for browser feature detection

### Detection Engine (`ai-detector.js`)
- Centralized detection logic
- Event-driven architecture
- Configurable detection patterns
- Extensible framework for new detection methods

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ support required
- No external dependencies
- Progressive enhancement design

## 📝 Configuration

### Detection Sensitivity
Modify detection thresholds in `ai-detector.js`:
```javascript
const HIGH_Z_INDEX_THRESHOLD = 9999;
const OVERLAY_COVERAGE_THRESHOLD = 0.5;
const SUSPICIOUS_PATTERNS = [...];
```

### Custom Patterns
Add new AI agent patterns:
```javascript
const AI_AGENT_PATTERNS = {
    'custom-agent': {
        name: 'Custom AI Agent',
        indicators: ['custom-pattern', 'agent-id'],
        extensionId: 'custom-extension-id'
    }
};
```

## 🚨 Important Notes

- **Research Tool**: This framework is designed for security research and analysis
- **Privacy**: All detection runs locally in the browser
- **Performance**: Continuous monitoring may impact browser performance
- **False Positives**: Some legitimate applications may trigger detections

## 📚 Research References

Based on research and techniques from:
- [Castle.io AI Bot Detection Series](https://blog.castle.io/)
- Web Bot HTTP Message Signatures (Cloudflare/OpenAI)
- Browser fingerprinting and automation detection research
- Modern AI agent behavioral analysis

## 🤝 Contributing

This is a research framework. Contributions for:
- New detection patterns
- Additional AI agent signatures
- Performance improvements
- Enhanced reporting features

## 📄 License

This project is provided for security research and educational purposes.

## 🔗 Quick Links

- **Main Dashboard**: `/index.html`
- **Live Demo**: `/pages/live-dashboard.html?demo=true`
- **Technical Documentation**: See source code comments
- **Test Suite**: Each page includes comprehensive testing functions

---

**⚠️ Disclaimer**: This tool is for security research and analysis purposes. Use responsibly and in accordance with applicable laws and regulations.
