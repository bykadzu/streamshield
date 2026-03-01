/**
 * OBS WebSocket Connection Manager
 *
 * Handles connection lifecycle, reconnection, and health monitoring.
 * Uses obs-websocket-js v5 (OBS WebSocket Protocol 5.x).
 *
 * Key OBS WebSocket requests we'll use:
 * - GetVersion: verify connection
 * - GetCurrentProgramScene: know what's showing
 * - SetCurrentProgramScene: switch to shield scene
 * - GetSourceScreenshot: capture frames for analysis
 * - ToggleSourceFilter: apply blur filters
 * - SetInputMute: mute audio sources
 * - CallVendorRequest: stop streaming (end stream)
 *
 * @see https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
 */

import OBSWebSocket from "obs-websocket-js";

export interface OBSConnectionConfig {
  url: string; // e.g. "ws://localhost:4455"
  password?: string;
  reconnectInterval?: number; // ms, default 5000
  maxReconnectAttempts?: number; // default 10
}

export interface OBSConnectionState {
  connected: boolean;
  obsVersion?: string;
  wsVersion?: string;
  currentScene?: string;
  error?: string;
}

export type ConnectionListener = (state: OBSConnectionState) => void;

/**
 * TODO (Franky): Implement the OBS connection manager
 *
 * Requirements:
 * 1. Connect to OBS via WebSocket with auto-reconnect
 * 2. Expose connection state as observable (for React hooks)
 * 3. Provide methods for all shield actions:
 *    - switchToShieldScene(sceneName: string)
 *    - switchToOriginalScene()
 *    - muteSource(sourceName: string)
 *    - unmuteSource(sourceName: string)
 *    - applyBlurFilter(sourceName: string)
 *    - removeBlurFilter(sourceName: string)
 *    - endStream()
 * 4. Handle disconnection gracefully (OBS crash, network issues)
 * 5. Health check: ping OBS every 10s to verify connection
 */
export class OBSClient {
  private obs: OBSWebSocket;
  private config: OBSConnectionConfig;
  private state: OBSConnectionState = { connected: false };
  private listeners: Set<ConnectionListener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;

  constructor(config: OBSConnectionConfig) {
    this.obs = new OBSWebSocket();
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      ...config,
    };
  }

  async connect(): Promise<void> {
    // TODO: Implement connection with auto-reconnect
    throw new Error("Not implemented — Franky, this is yours");
  }

  async disconnect(): Promise<void> {
    // TODO: Clean disconnection
    throw new Error("Not implemented");
  }

  async getFrameScreenshot(
    sourceName: string,
    width?: number,
    height?: number,
  ): Promise<string> {
    // TODO: Returns base64 image data from OBS GetSourceScreenshot
    throw new Error("Not implemented");
  }

  async switchScene(sceneName: string): Promise<void> {
    // TODO: Switch active scene (used for full-block shield)
    throw new Error("Not implemented");
  }

  async endStream(): Promise<void> {
    // TODO: Stop streaming via OBS WebSocket
    throw new Error("Not implemented");
  }

  onStateChange(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): OBSConnectionState {
    return { ...this.state };
  }

  private updateState(partial: Partial<OBSConnectionState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
