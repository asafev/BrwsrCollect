/**
 * Index file for detectors module
 * Exports all detector classes for easy importing
 * 
 * @module detectors
 */

export { NetworkCapabilitiesDetector } from './networkCapabilities.js';
export { BatteryStorageDetector } from './batteryStorage.js';
export { ActiveMeasurementsDetector, ACTIVE_MEASUREMENTS_CONFIG } from './activeMeasurements.js';
export { initCdpSignals } from './cdpSignals.js';
export { AudioFingerprintDetector, AUDIO_CONFIG } from './audioFingerprint.js';
export { WebRTCLeakDetector, WEBRTC_CONFIG } from './webRTCLeak.js';
export { WebGLFingerprintDetector } from './webGLfingerprint.js';
export { SpeechSynthesisDetector } from './speechSynthesis.js';
export { LanguageDetector } from './languageDetector.js';
export { CssComputedStyleDetector } from './cssComputedStyle.js';
export { WorkerSignalsDetector } from './workerSignals.js';
export { FontsDetector } from './fonts.js';
