/**
 * Audio Transcriber — Speech-to-text for audio detection
 *
 * Captures audio from OBS desktop audio and transcribes it.
 * Transcribed text is fed into the PatternEngine for detection.
 *
 * Uses Web Speech API for browser-based transcription (free),
 * with fallback support for Whisper API (higher accuracy).
 */

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
  duration?: number;
}

export interface AudioDetectionConfig {
  /** Enable audio detection */
  enabled: boolean;
  /** Minimum confidence threshold (0-1) */
  minConfidence: number;
  /** Use Whisper API (requires API key) or Web Speech API */
  useWhisper: boolean;
  /** OpenAI API key for Whisper (optional) */
  whisperApiKey?: string;
  /** Language for transcription */
  language: string;
  /** Buffer transcriptions and scan periodically (ms) */
  scanIntervalMs: number;
  /** Include interim results (partial transcriptions) */
  includeInterim: boolean;
}

const DEFAULT_CONFIG: AudioDetectionConfig = {
  enabled: true,
  minConfidence: 0.7,
  useWhisper: false,
  language: "en-US",
  scanIntervalMs: 1000,
  includeInterim: false,
};

export type TranscriptionListener = (result: TranscriptionResult) => void;

export class AudioTranscriber {
  private config: AudioDetectionConfig;
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private listeners: Set<TranscriptionListener> = new Set();
  private transcriptionBuffer: string = "";
  private pendingTranscription: string = "";
  private mediaStream: MediaStream | null = null;

  constructor(config: Partial<AudioDetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the audio transcriber
   * For browser-based transcription, uses Web Speech API
   */
  async initialize(): Promise<void> {
    if (this.config.useWhisper) {
      console.log("[Audio] Using Whisper API for transcription");
      if (!this.config.whisperApiKey) {
        console.warn("[Audio] No Whisper API key provided, transcription will fail");
      }
    } else {
      console.log("[Audio] Using Web Speech API for transcription");
      await this.initWebSpeech();
    }
  }

  /**
   * Initialize Web Speech API
   */
  private async initWebSpeech(): Promise<void> {
    // Check for browser support - use 'any' to avoid type issues with vendor prefixes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.error("[Audio] Web Speech API not supported in this environment");
      throw new Error("Web Speech API not available");
    }

    this.recognition = new SpeechRecognitionClass();
    this.recognition!.continuous = true;
    this.recognition!.interimResults = this.config.includeInterim;
    this.recognition!.lang = this.config.language;

    this.recognition!.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;
        const isFinal = event.results[i].isFinal;

        if (isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }

        // Emit to listeners
        const result: TranscriptionResult = {
          text: transcript,
          confidence,
          isFinal,
          timestamp: Date.now(),
        };

        for (const listener of this.listeners) {
          listener(result);
        }
      }

      // Update buffer
      if (finalTranscript) {
        this.transcriptionBuffer += " " + finalTranscript;
        this.pendingTranscription = "";
      } else if (interimTranscript) {
        this.pendingTranscription = interimTranscript;
      }
    };

    this.recognition!.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("[Audio] Speech recognition error:", event.error);
      
      // Auto-restart on certain errors
      if (event.error === "no-speech" || event.error === "audio-capture") {
        setTimeout(() => {
          if (this.isListening) {
            this.restartRecognition();
          }
        }, 1000);
      }
    };

    this.recognition!.onend = () => {
      // Auto-restart if we're still supposed to be listening
      if (this.isListening && !this.config.useWhisper) {
        setTimeout(() => this.restartRecognition(), 100);
      }
    };

    console.log("[Audio] Web Speech API initialized");
  }

  /**
   * Start listening for audio
   */
  async start(): Promise<void> {
    if (this.isListening) {
      console.warn("[Audio] Already listening");
      return;
    }

    console.log("[Audio] Starting audio transcription...");
    this.isListening = true;

    if (!this.config.useWhisper && this.recognition) {
      try {
        this.recognition.start();
        console.log("[Audio] Web Speech recognition started");
      } catch (error) {
        // May already be running
        console.warn("[Audio] Recognition start error:", error);
      }
    }
  }

  /**
   * Stop listening for audio
   */
  stop(): void {
    if (!this.isListening) return;

    console.log("[Audio] Stopping audio transcription...");
    this.isListening = false;

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.warn("[Audio] Recognition stop error:", error);
      }
    }

    // Clean up media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  /**
   * Restart recognition (for error recovery)
   */
  private restartRecognition(): void {
    if (!this.recognition || this.config.useWhisper) return;

    try {
      this.recognition.start();
    } catch (error) {
      console.warn("[Audio] Restart error:", error);
    }
  }

  /**
   * Get current transcription buffer
   */
  getBuffer(): string {
    return this.transcriptionBuffer.trim();
  }

  /**
   * Get pending (interim) transcription
   */
  getPendingTranscription(): string {
    return this.pendingTranscription;
  }

  /**
   * Clear the transcription buffer
   */
  clearBuffer(): void {
    this.transcriptionBuffer = "";
    this.pendingTranscription = "";
  }

  /**
   * Get and clear buffer atomically
   */
  flushBuffer(): string {
    const text = this.transcriptionBuffer.trim();
    this.transcriptionBuffer = "";
    return text;
  }

  /**
   * Add listener for transcription results
   */
  onTranscription(listener: TranscriptionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Check if transcriber is listening
   */
  isRunning(): boolean {
    return this.isListening;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AudioDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AudioDetectionConfig {
    return { ...this.config };
  }

  /**
   * Transcribe audio file using Whisper API (for recorded audio)
   */
  async transcribeFile(audioBlob: Blob): Promise<TranscriptionResult> {
    if (!this.config.whisperApiKey) {
      throw new Error("Whisper API key required for file transcription");
    }

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.mp3");
    formData.append("model", "whisper-1");
    formData.append("language", this.config.language.split("-")[0]);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.whisperApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status}`);
    }

    const data = await response.json() as { text: string };

    return {
      text: data.text,
      confidence: 1.0, // Whisper doesn't provide confidence
      isFinal: true,
      timestamp: Date.now(),
    };
  }
}

// Export default instance
export const audioTranscriber = new AudioTranscriber();
