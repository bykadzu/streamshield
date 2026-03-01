/**
 * StreamShield App — Phase 1 Integration
 * 
 * Wires OBS connection + DetectionPipeline to Dashboard UI.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { OBSClient } from "./lib/obs/client";
import { OCRPipeline } from "./lib/detection/ocr";
import { PatternEngine } from "./lib/detection/patterns";
import { DetectionLog, type DetectionEvent } from "./lib/storage/detection-log";
import { DetectionPipeline } from "./lib/detection/pipeline";

type Page = "dashboard" | "settings" | "review";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [obsClient, setObsClient] = useState<OBSClient | null>(null);
  const [_pipeline, setPipeline] = useState<DetectionPipeline | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [framesScanned, setFramesScanned] = useState(0);
  const [threatsBlocked, setThreatsBlocked] = useState(0);
  const [recentDetections, setRecentDetections] = useState<DetectionEvent[]>([]);
  const [obsConnected, setObsConnected] = useState(false);
  const [obsConnecting, setObsConnecting] = useState(false);
  const [obsError, setObsError] = useState<string | null>(null);

  const pipelineRef = useRef<DetectionPipeline | null>(null);

  // Pattern engine and OCR instances
  const patternEngineRef = useRef<PatternEngine>(new PatternEngine());
  const ocrPipelineRef = useRef<OCRPipeline>(new OCRPipeline());
  const storageRef = useRef<DetectionLog>(new DetectionLog());

  // Initialize patterns on mount
  useEffect(() => {
    const loadPatterns = async () => {
      try {
        const response = await fetch("/patterns/default.json");
        const config = await response.json();
        await patternEngineRef.current.loadPatterns(config);
        console.log("[App] Patterns loaded");
      } catch (err) {
        console.error("[App] Failed to load patterns:", err);
      }
    };
    loadPatterns();
  }, []);

  // Connect to OBS
  const connectOBS = useCallback(async () => {
    if (obsConnecting || obsConnected) return;

    setObsConnecting(true);
    setObsError(null);

    try {
      const client = new OBSClient({ url: "ws://localhost:4455" });
      await client.connect();
      setObsClient(client);
      setObsConnected(true);
      console.log("[App] OBS connected");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setObsError(msg);
      console.error("[App] OBS connection error:", msg);
    } finally {
      setObsConnecting(false);
    }
  }, [obsConnecting, obsConnected]);

  // Disconnect from OBS
  const disconnectOBS = useCallback(async () => {
    if (!obsClient) return;

    try {
      await obsClient.disconnect();
    } catch (err) {
      console.error("[App] OBS disconnect error:", err);
    }
    setObsClient(null);
    setObsConnected(false);
    setIsMonitoring(false);
  }, [obsClient]);

  // Start monitoring
  const startMonitoring = useCallback(async () => {
    if (!obsClient || pipelineRef.current) return;

    // Initialize storage
    await storageRef.current.initialize();

    // Create pipeline
    const p = new DetectionPipeline(
      obsClient,
      ocrPipelineRef.current,
      patternEngineRef.current,
      storageRef.current,
      {
        fps: 2,
        obsSourceName: "Screen Capture",
        shieldSceneName: "StreamShield Blocked",
      }
    );

    // Listen for detections
    p.onDetection((event) => {
      setFramesScanned((f) => f + 1);
      if (event.matches.length > 0) {
        setThreatsBlocked((t) => t + event.matches.length);
        setRecentDetections((prev) => [event, ...prev].slice(0, 10));
      }
    });

    await p.start();
    pipelineRef.current = p;
    setPipeline(p);
    setIsMonitoring(true);
    console.log("[App] Monitoring started");
  }, [obsClient]);

  // Stop monitoring
  const stopMonitoring = useCallback(async () => {
    if (!pipelineRef.current) return;

    pipelineRef.current.stop();
    pipelineRef.current = null;
    setPipeline(null);
    setIsMonitoring(false);
    console.log("[App] Monitoring stopped");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pipelineRef.current) {
        pipelineRef.current.stop();
      }
      ocrPipelineRef.current.shutdown();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Navigation */}
      <nav className="flex items-center gap-4 border-b border-gray-800 px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-emerald-400">
            StreamShield
          </span>
          <span className="rounded bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-400">
            v0.1.0
          </span>
        </div>
        <div className="flex gap-1 ml-8">
          {(["dashboard", "settings", "review"] as Page[]).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`rounded px-3 py-1.5 text-sm capitalize transition-colors ${
                page === p
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="p-6">
        {page === "dashboard" && (
          <DashboardPage
            obsConnected={obsConnected}
            obsConnecting={obsConnecting}
            obsError={obsError}
            isMonitoring={isMonitoring}
            framesScanned={framesScanned}
            threatsBlocked={threatsBlocked}
            recentDetections={recentDetections}
            onConnect={connectOBS}
            onDisconnect={disconnectOBS}
            onStartMonitoring={startMonitoring}
            onStopMonitoring={stopMonitoring}
          />
        )}
        {page === "settings" && <SettingsPage />}
        {page === "review" && <ReviewPage />}
      </main>
    </div>
  );
}

interface DashboardPageProps {
  obsConnected: boolean;
  obsConnecting: boolean;
  obsError: string | null;
  isMonitoring: boolean;
  framesScanned: number;
  threatsBlocked: number;
  recentDetections: DetectionEvent[];
  onConnect: () => void;
  onDisconnect: () => void;
  onStartMonitoring: () => void;
  onStopMonitoring: () => void;
}

function DashboardPage({
  obsConnected,
  obsConnecting,
  obsError,
  isMonitoring,
  framesScanned,
  threatsBlocked,
  recentDetections,
  onConnect,
  onDisconnect,
  onStartMonitoring,
  onStopMonitoring,
}: DashboardPageProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Connection Status */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${
              obsConnected
                ? "bg-emerald-500"
                : obsConnecting
                ? "bg-yellow-500 animate-pulse"
                : "bg-red-500"
            }`}
          />
          <span className="text-lg font-medium">
            OBS:{" "}
            {obsConnected
              ? "Connected"
              : obsConnecting
              ? "Connecting..."
              : "Disconnected"}
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-400">
          {obsConnected
            ? isMonitoring
              ? "Monitoring active — protecting your stream."
              : "Ready to monitor your stream."
            : "Connect to OBS to start monitoring your stream."}
        </p>

        {obsError && <p className="mt-2 text-sm text-red-400">{obsError}</p>}

        {/* Connect/Disconnect Buttons */}
        {!obsConnected && !obsConnecting && (
          <button
            onClick={onConnect}
            className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 transition-colors"
          >
            Connect to OBS
          </button>
        )}

        {obsConnected && !isMonitoring && (
          <>
            <button
              onClick={onStartMonitoring}
              className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 transition-colors"
            >
              Start Monitoring
            </button>
            <button
              onClick={onDisconnect}
              className="ml-3 mt-4 rounded bg-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-600 transition-colors"
            >
              Disconnect
            </button>
          </>
        )}

        {isMonitoring && (
          <button
            onClick={onStopMonitoring}
            className="mt-4 rounded bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 transition-colors"
          >
            Stop Monitoring
          </button>
        )}
      </div>

      {/* Shield Status */}
      <div className="grid grid-cols-3 gap-4">
        <StatusCard
          label="Shield"
          value={isMonitoring ? "Active" : "Inactive"}
          color={isMonitoring ? "green" : "gray"}
        />
        <StatusCard
          label="Frames Scanned"
          value={framesScanned.toString()}
          color="gray"
        />
        <StatusCard
          label="Threats Blocked"
          value={threatsBlocked.toString()}
          color={threatsBlocked > 0 ? "yellow" : "gray"}
        />
      </div>

      {/* Recent Detections */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-medium mb-4">Recent Detections</h2>
        {recentDetections.length === 0 ? (
          <p className="text-sm text-gray-500">
            No detections yet. Start a monitoring session to see activity
            here.
          </p>
        ) : (
          <div className="space-y-2">
            {recentDetections.map((detection, idx) => (
              <div
                key={`${detection.id}-${idx}`}
                className="flex items-center justify-between rounded bg-gray-800 p-3"
              >
                <div>
                  <span className="font-medium text-yellow-400">
                    {detection.matches[0]?.patternName || "Unknown"}
                  </span>
                  <span className="ml-2 text-sm text-gray-400">
                    ({detection.actionTaken})
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(detection.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "yellow" | "red" | "gray";
}) {
  const colorMap = {
    green: "text-emerald-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
    gray: "text-gray-400",
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorMap[color]}`}>{value}</p>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <p className="text-gray-400">Settings UI — Phase 1 TODO</p>
        <p className="text-sm text-gray-500 mt-2">
          OBS connection, detection sensitivity, custom patterns, kill-phrase
          config.
        </p>
      </div>
    </div>
  );
}

function ReviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Post-Stream Review</h1>
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <p className="text-gray-400">Review Queue — Phase 1 TODO</p>
        <p className="text-sm text-gray-500 mt-2">
          After each stream, review what StreamShield detected and adjust
          sensitivity.
        </p>
      </div>
    </div>
  );
}
