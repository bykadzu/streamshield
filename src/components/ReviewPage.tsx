/**
 * ReviewPage Component — SS-08
 * Post-stream review: session history, detections, export
 */

import { useState, useEffect } from "react";
import { DetectionLog, type DetectionEvent, sessionRecordToReviewSession, type ReviewSession } from "../lib/storage/detection-log";

export default function ReviewPage() {
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [detections, setDetections] = useState<DetectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const storage = new DetectionLog();

  // Load sessions on mount
  useEffect(() => {
    const loadData = async () => {
      await storage.initialize();
      const recent = await storage.getRecentSessions(20);
      setSessions(recent.map(sessionRecordToReviewSession));
      setLoading(false);
    };
    loadData();
  }, []);

  // Load detections for selected session
  useEffect(() => {
    if (!selectedSession) {
      setDetections([]);
      return;
    }

    const loadDetections = async () => {
      // DetectionLog would need a method to get detections by session
      // For now, we'll filter from recent
      const all = await storage.getRecentSessions(100);
      const session = all.find((s) => s.id === selectedSession);
      if (session) {
        // Mock: in real impl, would fetch full session detections
        setDetections([]);
      }
    };
    loadDetections();
  }, [selectedSession]);

  // Export session as JSON
  const exportSession = async (sessionId: string) => {
    setExporting(true);
    try {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      const data = {
        session,
        exportedAt: new Date().toISOString(),
        version: "StreamShield v0.1.0",
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `streamshield-session-${sessionId}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // Delete session
  const deleteSession = async (sessionId: string) => {
    if (!confirm("Delete this session? This cannot be undone.")) return;
    
    // In a real impl, DetectionLog would have deleteSession()
    setSessions((s) => s.filter((sess) => sess.id !== sessionId));
    if (selectedSession === sessionId) {
      setSelectedSession(null);
    }
  };

  // Format duration
  const formatDuration = (start: string, end: string | null | undefined) => {
    if (!end) return "In progress";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading sessions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Post-Stream Review</h1>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
          <p className="text-gray-400">No sessions recorded yet.</p>
          <p className="text-sm text-gray-500 mt-2">
            Start a monitoring session to see detection history here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {/* Session List */}
          <div className="col-span-1 rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h2 className="text-lg font-medium mb-4">Recent Sessions</h2>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session.id)}
                  className={`w-full text-left p-3 rounded transition-colors ${
                    selectedSession === session.id
                      ? "bg-emerald-900/50 border border-emerald-700"
                      : "bg-gray-800 hover:bg-gray-750"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {formatDate(session.startTime)}
                    </span>
                    {session.detectionCount > 0 && (
                      <span className="px-2 py-0.5 bg-yellow-900 text-yellow-400 text-xs rounded">
                        {session.detectionCount} alerts
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Duration: {formatDuration(session.startTime, session.endTime || undefined)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Session Details */}
          <div className="col-span-2 space-y-4">
            {selectedSession ? (
              <>
                {(() => {
                  const session = sessions.find((s) => s.id === selectedSession);
                  if (!session) return null;

                  return (
                    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium">Session Details</h2>
                        <div className="flex gap-2">
                          <button
                            onClick={() => exportSession(session.id)}
                            disabled={exporting}
                            className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm disabled:opacity-50"
                          >
                            {exporting ? "Exporting..." : "Export JSON"}
                          </button>
                          <button
                            onClick={() => deleteSession(session.id)}
                            className="px-3 py-1.5 rounded bg-red-900/50 hover:bg-red-900 text-red-400 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-gray-800 rounded p-3">
                          <p className="text-xs text-gray-500">Start</p>
                          <p className="text-sm">{formatDate(session.startTime)}</p>
                        </div>
                        <div className="bg-gray-800 rounded p-3">
                          <p className="text-xs text-gray-500">Duration</p>
                          <p className="text-sm">
                            {formatDuration(session.startTime, session.endTime || undefined)}
                          </p>
                        </div>
                        <div className="bg-gray-800 rounded p-3">
                          <p className="text-xs text-gray-500">Detections</p>
                          <p className="text-sm">{session.detectionCount}</p>
                        </div>
                      </div>

                      {/* Detection Timeline */}
                      <h3 className="text-md font-medium mb-3">Detection Timeline</h3>
                      {detections.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No detections in this session.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {detections.map((d, idx) => (
                            <div
                              key={`${d.id}-${idx}`}
                              className="flex items-start gap-3 p-3 bg-gray-800 rounded"
                            >
                              <div className="w-2 h-2 mt-1.5 rounded-full bg-yellow-500" />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-yellow-400">
                                    {d.matches[0]?.patternName || "Unknown"}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(d.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-400 mt-1">
                                  Action: {d.actionTaken}
                                </p>
                                {d.matches[0]?.matchedText && (
                                  <p className="text-xs text-gray-500 mt-1 font-mono">
                                    "{d.matches[0].matchedText}"
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
                <p className="text-gray-400">Select a session to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
