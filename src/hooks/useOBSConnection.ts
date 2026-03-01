/**
 * OBS Connection Hook — Manages OBS WebSocket connection state
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { OBSClient } from "../lib/obs/client";

export interface OBSConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  obsClient: OBSClient | null;
  studioMode: boolean;
}

const DEFAULT_OBWS_URL = "ws://localhost:4455";

export function useOBSConnection() {
  const [state, setState] = useState<OBSConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    obsClient: null,
    studioMode: false,
  });

  const clientRef = useRef<OBSClient | null>(null);

  const connect = useCallback(async (url: string = DEFAULT_OBWS_URL, password?: string) => {
    if (state.isConnecting || state.isConnected) return;

    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const client = new OBSClient({ url, password });
      await client.connect();
      
      clientRef.current = client;
      
      // Studio mode check - optional, not critical
      let studioMode = false;
      try {
        studioMode = await (client as unknown as { getStudioModeEnabled: () => Promise<boolean> }).getStudioModeEnabled();
      } catch {
        // Method may not exist, ignore
      }

      setState({
        isConnected: true,
        isConnecting: false,
        error: null,
        obsClient: client,
        studioMode,
      });

      console.log("[useOBS] Connected to OBS");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Connection failed";
      setState((s) => ({
        ...s,
        isConnecting: false,
        error: errorMsg,
        isConnected: false,
      }));
      console.error("[useOBS] Connection error:", errorMsg);
    }
  }, [state.isConnecting, state.isConnected]);

  const disconnect = useCallback(async () => {
    if (!clientRef.current) return;

    try {
      await clientRef.current.disconnect();
    } catch (err) {
      console.error("[useOBS] Disconnect error:", err);
    }

    clientRef.current = null;
    setState((s) => ({
      ...s,
      isConnected: false,
      isConnecting: false,
      obsClient: null,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect().catch(console.error);
      }
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
  };
}
