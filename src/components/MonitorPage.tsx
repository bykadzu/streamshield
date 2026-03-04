/**
 * MonitorPage Component — SS-06
 * Live monitoring view: shows current frame, detection status, real-time alerts
 */

import { useState, useEffect, useRef } from "react";
import type { DetectionEvent } from "../lib/storage/detection-log";

interface MonitorPageProps {
  isMonitoring: boolean;
  framesScanned: number;
  threatsBlocked: number;
  recentDetections: DetectionEvent[];
  onStopMonitoring: () => void;
}

export default function MonitorPage({
  isMonitoring,
  framesScanned,
  threatsBlocked,
  recentDetections,
  onStopMonitoring,
}: MonitorPageProps) {
  const [processingStatus, setProcessingStatus] = useState<string>("Idle");
  const [fps, setFps] = useState(0);
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(Date.now());

  // Simulate frame updates (in real app, would come from OBS via WebSocket)
  useEffect(() => {
    if (!isMonitoring) {
      setProcessingStatus("Idle");
      return;
    }

    setProcessingStatus("Monitoring...");

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastFrameTime.current;
      lastFrameTime.current = now;

      // Track frame times for FPS calculation
      frameTimesRef.current = [...frameTimesRef.current, delta].slice(-30);
      if (frameTimesRef.current.length >= 2) {
        const avgDelta = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
        setFps(Math.round(1000 / avgDelta));
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isMonitoring]);

  // Get latest detection
  const latestDetection = recentDetections[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Live Monitor</h1>
        <div className="flex items-center gap-2">
          <span
            className={`h-3 w-3 rounded-full ${
              isMonitoring ? "bg-emerald-500 animate-pulse" : "bg-gray-500"
            }`}
          />
          <span className="text-sm text-gray-400">
            {isMonitoring ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      {/* Main monitoring area */}
      <div className="grid grid-cols-3 gap-6">
        {/* Live Frame View */}
        <div className="col-span-2 rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
            <span className="text-sm font-medium">Live Frame</span>
            <span className="text-xs text-gray-500">2 FPS</span>
          </div>
          <div className="relative aspect-video bg-gray-950 flex items-center justify-center">
            {isMonitoring ? (
              <div className="text-center text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm">Capturing frames from OBS...</p>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm">Start monitoring to see live frames</p>
              </div>
            )}

            {/* Detection overlay */}
            {latestDetection && latestDetection.matches.length > 0 && (
              <div className="absolute inset-0 border-4 border-red-500 animate-pulse pointer-events-none" />
            )}
          </div>
        </div>

        {/* Status Panel */}
        <div className="space-y-4">
          {/* Processing Status */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              Status
            </h3>
            <p
              className={`text-lg font-medium ${
                isMonitoring ? "text-emerald-400" : "text-gray-400"
              }`}
            >
              {processingStatus}
            </p>
          </div>

          {/* FPS */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              Processing FPS
            </h3>
            <p className="text-2xl font-bold text-gray-300">{fps}</p>
          </div>

          {/* Frames Scanned */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              Frames Scanned
            </h3>
            <p className="text-2xl font-bold text-gray-300">{framesScanned}</p>
          </div>

          {/* Threats Blocked */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              Threats Blocked
            </h3>
            <p
              className={`text-2xl font-bold ${
                threatsBlocked > 0 ? "text-red-400" : "text-gray-300"
              }`}
            >
              {threatsBlocked}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="text-lg font-medium mb-4">Real-time Alerts</h2>
        {recentDetections.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">
            No detections yet. Monitoring for PII, secrets, and custom patterns.
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentDetections.slice(0, 10).map((detection, idx) => (
              <div
                key={`${detection.id}-${idx}`}
                className="flex items-center justify-between rounded bg-gray-800 p-3 border-l-4 border-red-500"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-red-400">
                      {detection.matches[0]?.patternName || "Unknown Threat"}
                    </span>
                    <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                      {detection.actionTaken}
                    </span>
                  </div>
                  {detection.matches[0]?.matchedText && (
                    <p className="mt-1 text-xs text-gray-400 font-mono truncate">
                      {detection.matches[0].matchedText}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                  {new Date(detection.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      {isMonitoring && (
        <div className="flex justify-center">
          <button
            onClick={onStopMonitoring}
            className="rounded-lg bg-red-600 px-6 py-3 font-medium hover:bg-red-500 transition-colors"
          >
            Stop Monitoring
          </button>
        </div>
      )}
    </div>
  );
}
