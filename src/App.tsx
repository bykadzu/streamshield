import { useState } from "react";

type Page = "dashboard" | "settings" | "review";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

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
        {page === "dashboard" && <DashboardPage />}
        {page === "settings" && <SettingsPage />}
        {page === "review" && <ReviewPage />}
      </main>
    </div>
  );
}

function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Connection Status */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span className="text-lg font-medium">OBS: Disconnected</span>
        </div>
        <p className="mt-2 text-sm text-gray-400">
          Connect to OBS to start monitoring your stream.
        </p>
        <button className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 transition-colors">
          Connect to OBS
        </button>
      </div>

      {/* Shield Status */}
      <div className="grid grid-cols-3 gap-4">
        <StatusCard label="Shield" value="Inactive" color="gray" />
        <StatusCard label="Frames Scanned" value="0" color="gray" />
        <StatusCard label="Threats Blocked" value="0" color="gray" />
      </div>

      {/* Recent Detections */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-medium mb-4">Recent Detections</h2>
        <p className="text-sm text-gray-500">
          No detections yet. Start a monitoring session to see activity here.
        </p>
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
