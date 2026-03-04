/**
 * Audio Detection Module
 *
 * Provides speech-to-text transcription and pattern matching for audio.
 * Works alongside visual OCR detection to catch spoken sensitive content.
 */

export { AudioTranscriber, audioTranscriber, type TranscriptionResult, type AudioDetectionConfig, type TranscriptionListener } from "./transcriber";
export { AudioDetectionPipeline, createAudioPipeline, type AudioDetectionEvent, type AudioPipelineConfig, type AudioDetectionListener } from "./detector";
