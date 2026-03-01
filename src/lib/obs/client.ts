/**
 * OBS WebSocket Connection Manager
 *
 * Handles connection lifecycle, reconnection, and health monitoring.
 * Uses obs-websocket-js v5 (OBS WebSocket Protocol 5.x).
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

export class OBSClient {
  private obs: OBSWebSocket;
  private config: OBSConnectionConfig;
  private state: OBSConnectionState = { connected: false };
  private listeners: Set<ConnectionListener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private originalSceneName: string | null = null;
  private isIntentionallyDisconnected = false;

  constructor(config: OBSConnectionConfig) {
    this.obs = new OBSWebSocket();
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      ...config,
    };

    // Set up event listeners
    this.obs.on("ConnectionClosed", (event: { code: number; reason: string }) => {
      console.log("[OBS] Connection closed:", event);
      this.updateState({ connected: false });
      
      if (!this.isIntentionallyDisconnected) {
        this.scheduleReconnect();
      }
    });

    this.obs.on("CurrentProgramSceneChanged", (event: { sceneName: string }) => {
      console.log("[OBS] Scene changed to:", event.sceneName);
      this.updateState({ currentScene: event.sceneName });
    });
  }

  async connect(): Promise<void> {
    console.log(`[OBS] Connecting to ${this.config.url}...`);
    this.isIntentionallyDisconnected = false;

    try {
      await this.obs.connect(this.config);
      
      // Get version info
      const version = await this.obs.call("GetVersion");
      
      // Get current scene
      const programScene = await this.obs.call("GetCurrentProgramScene");

      this.updateState({
        connected: true,
        obsVersion: version.obsVersion as string,
        wsVersion: version.obsWebSocketVersion as string,
        currentScene: programScene.sceneName as string,
      });

      this.reconnectAttempts = 0;
      this.startHealthCheck();
      
      console.log("[OBS] Connected successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[OBS] Connection failed:", errorMessage);
      this.updateState({ connected: false, error: errorMessage });
      this.scheduleReconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log("[OBS] Intentionally disconnecting...");
    this.isIntentionallyDisconnected = true;
    this.stopHealthCheck();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      await this.obs.disconnect();
    } catch (error) {
      console.error("[OBS] Error during disconnect:", error);
    }
    
    this.updateState({ connected: false });
  }

  async getFrameScreenshot(
    sourceName: string,
    width: number = 1280,
    height: number = 720,
  ): Promise<string> {
    if (!this.state.connected) {
      throw new Error("OBS not connected");
    }

    try {
      const result = await this.obs.call("GetSourceScreenshot", {
        sourceName,
        imageFormat: "png",
        imageWidth: width,
        imageHeight: height,
      });

      return result.imageData as string; // Base64 PNG
    } catch (error) {
      console.error("[OBS] Failed to capture screenshot:", error);
      throw error;
    }
  }

  async switchScene(sceneName: string): Promise<void> {
    if (!this.state.connected) {
      throw new Error("OBS not connected");
    }

    // Store original scene if not already stored
    if (!this.originalSceneName && this.state.currentScene) {
      this.originalSceneName = this.state.currentScene;
    }

    await this.obs.call("SetCurrentProgramScene", {
      sceneName,
    });

    this.updateState({ currentScene: sceneName });
    console.log(`[OBS] Switched to scene: ${sceneName}`);
  }

  async switchToOriginalScene(): Promise<void> {
    if (this.originalSceneName) {
      await this.switchScene(this.originalSceneName);
      this.originalSceneName = null;
    }
  }

  async muteSource(sourceName: string, mute: boolean): Promise<void> {
    if (!this.state.connected) {
      throw new Error("OBS not connected");
    }

    await this.obs.call("SetInputMute", {
      inputName: sourceName,
      inputMuted: mute,
    });

    console.log(`[OBS] ${mute ? "Muted" : "Unmuted"} source: ${sourceName}`);
  }

  async applyBlurFilter(
    sourceName: string,
    filterName: string = "StreamShield Blur",
    blurRadius: number = 20,
  ): Promise<void> {
    if (!this.state.connected) {
      throw new Error("OBS not connected");
    }

    // Try to create the filter - if it exists, this may error but that's OK
    try {
      await this.obs.call("CreateOrGetSourceFilter", {
        sourceName,
        filterName,
        filterType: "blur_filter",
        filterSettings: {
          blur_type: "box",
          blur_radius: blurRadius,
        },
      });
      console.log(`[OBS] Applied blur filter to: ${sourceName}`);
    } catch (error) {
      console.error("[OBS] Failed to apply blur filter:", error);
      throw error;
    }
  }

  async removeBlurFilter(sourceName: string, filterName: string = "StreamShield Blur"): Promise<void> {
    if (!this.state.connected) {
      throw new Error("OBS not connected");
    }

    try {
      await this.obs.call("RemoveSourceFilter", {
        sourceName,
        filterName,
      });
      console.log(`[OBS] Removed blur filter from: ${sourceName}`);
    } catch (error) {
      // Filter might not exist, that's OK
      console.log(`[OBS] Filter removal (may not exist): ${filterName}`);
    }
  }

  async endStream(): Promise<void> {
    if (!this.state.connected) {
      throw new Error("OBS not connected");
    }

    try {
      // Stop streaming
      await this.obs.call("StopStream");
      console.log("[OBS] Stream ended");
    } catch (error) {
      console.error("[OBS] Failed to end stream:", error);
      throw error;
    }
  }

  async getSceneList(): Promise<string[]> {
    if (!this.state.connected) {
      throw new Error("OBS not connected");
    }

    const result = await this.obs.call("GetSceneList");
    return (result.scenes as Array<{ sceneName: string }>).map((s) => s.sceneName);
  }

  async getSourceList(): Promise<string[]> {
    if (!this.state.connected) {
      throw new Error("OBS not connected");
    }

    const result = await this.obs.call("GetInputList");
    return (result.inputs as Array<{ inputName: string }>).map((i) => i.inputName);
  }

  onStateChange(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): OBSConnectionState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.connected;
  }

  private updateState(partial: Partial<OBSConnectionState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private scheduleReconnect(): void {
    if (this.isIntentionallyDisconnected) return;
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
      console.error("[OBS] Max reconnect attempts reached");
      this.updateState({ error: "Max reconnection attempts reached" });
      return;
    }

    const delay = this.config.reconnectInterval || 5000;
    console.log(`[OBS] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // Connection error will trigger scheduleReconnect again via event handler
      });
    }, delay);
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();
    
    this.healthCheckInterval = setInterval(async () => {
      if (!this.state.connected || this.isIntentionallyDisconnected) return;
      
      try {
        await this.obs.call("GetVersion");
        // Connection is healthy
      } catch (error) {
        console.warn("[OBS] Health check failed, connection may be lost");
      }
    }, 10000);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}
