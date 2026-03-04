/**
 * SettingsPage Component — SS-07
 * OBS connection settings, detection config, custom patterns
 */

import { useState, useEffect } from "react";
import { OBSClient } from "../lib/obs/client";

interface Settings {
  obsUrl: string;
  obsPassword: string;
  obsSourceName: string;
  shieldSceneName: string;
  sensitivity: number;
  categories: {
    PII: boolean;
    secrets: boolean;
    violence: boolean;
    hate: boolean;
    custom: boolean;
  };
  customPatterns: Array<{
    id: string;
    name: string;
    pattern: string;
    enabled: boolean;
  }>;
}

const DEFAULT_SETTINGS: Settings = {
  obsUrl: "ws://localhost:4455",
  obsPassword: "",
  obsSourceName: "Screen Capture",
  shieldSceneName: "StreamShield Blocked",
  sensitivity: 50,
  categories: {
    PII: true,
    secrets: true,
    violence: true,
    hate: true,
    custom: true,
  },
  customPatterns: [],
};

const CATEGORIES = [
  { key: "PII", label: "PII (names, emails, phones)", color: "red" },
  { key: "secrets", label: "Secrets (API keys, passwords)", color: "orange" },
  { key: "violence", label: "Violence & Weapons", color: "red" },
  { key: "hate", label: "Hate Symbols", color: "orange" },
  { key: "custom", label: "Custom Patterns", color: "blue" },
] as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [newPattern, setNewPattern] = useState({ name: "", pattern: "" });
  const [obsScenes, setObsScenes] = useState<string[]>([]);
  const [obsSources, setObsSources] = useState<string[]>([]);

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("streamshield-settings");
    if (stored) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    }
  }, []);

  // Save settings
  const handleSave = () => {
    localStorage.setItem("streamshield-settings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Test OBS connection
  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const client = new OBSClient({
        url: settings.obsUrl,
        password: settings.obsPassword,
      });

      await client.connect();
      
      // Get scenes and sources
      const scenes = await client.getSceneList();
      const sources = await client.getSourceList();
      
      setObsScenes(scenes);
      setObsSources(sources);
      // Scenes loaded
      
      await client.disconnect();
      setTestResult({ ok: true, message: "Connection successful!" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setTestResult({ ok: false, message: msg });
    } finally {
      setTesting(false);
    }
  };

  // Add custom pattern
  const addPattern = () => {
    if (!newPattern.name || !newPattern.pattern) return;
    
    const pattern = {
      id: `custom-${Date.now()}`,
      name: newPattern.name,
      pattern: newPattern.pattern,
      enabled: true,
    };
    
    setSettings((s) => ({
      ...s,
      customPatterns: [...s.customPatterns, pattern],
    }));
    setNewPattern({ name: "", pattern: "" });
  };

  // Remove custom pattern
  const removePattern = (id: string) => {
    setSettings((s) => ({
      ...s,
      customPatterns: s.customPatterns.filter((p) => p.id !== id),
    }));
  };

  // Toggle pattern enabled
  const togglePattern = (id: string) => {
    setSettings((s) => ({
      ...s,
      customPatterns: s.customPatterns.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      ),
    }));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button
          onClick={handleSave}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            saved
              ? "bg-green-600 text-white"
              : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>

      {/* OBS Connection */}
      <section className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-medium mb-4">OBS Connection</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">WebSocket URL</label>
            <input
              type="text"
              value={settings.obsUrl}
              onChange={(e) => setSettings((s) => ({ ...s, obsUrl: e.target.value }))}
              className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
              placeholder="ws://localhost:4455"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password (optional)</label>
            <input
              type="password"
              value={settings.obsPassword}
              onChange={(e) => setSettings((s) => ({ ...s, obsPassword: e.target.value }))}
              className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
              placeholder="OBS WebSocket password"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Capture Source</label>
            <input
              type="text"
              value={settings.obsSourceName}
              onChange={(e) => setSettings((s) => ({ ...s, obsSourceName: e.target.value }))}
              className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
              placeholder="Screen Capture"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Shield Scene</label>
            <input
              type="text"
              value={settings.shieldSceneName}
              onChange={(e) => setSettings((s) => ({ ...s, shieldSceneName: e.target.value }))}
              className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
              placeholder="StreamShield Blocked"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={testConnection}
            disabled={testing}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-sm"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
          
          {testResult && (
            <span className={`text-sm ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
              {testResult.message}
            </span>
          )}
        </div>

        {/* Scene/Source lists if available */}
        {obsScenes.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400 mb-1">Available Scenes:</p>
              <div className="flex flex-wrap gap-1">
                {obsScenes.map((s) => (
                  <span key={s} className="px-2 py-0.5 bg-gray-800 rounded text-xs">{s}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Available Sources:</p>
              <div className="flex flex-wrap gap-1">
                {obsSources.slice(0, 10).map((s) => (
                  <span key={s} className="px-2 py-0.5 bg-gray-800 rounded text-xs">{s}</span>
                ))}
                {obsSources.length > 10 && (
                  <span className="text-gray-500 text-xs">+{obsSources.length - 10} more</span>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Detection Categories */}
      <section className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-medium mb-4">Detection Categories</h2>
        
        <div className="space-y-3">
          {CATEGORIES.map((cat) => (
            <label key={cat.key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.categories[cat.key as keyof typeof settings.categories]}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    categories: { ...s.categories, [cat.key]: e.target.checked },
                  }))
                }
                className="w-4 h-4 rounded bg-gray-800 border-gray-700"
              />
              <span className="text-sm">{cat.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Sensitivity */}
      <section className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-medium mb-4">Detection Sensitivity</h2>
        
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="100"
            value={settings.sensitivity}
            onChange={(e) => setSettings((s) => ({ ...s, sensitivity: Number(e.target.value) }))}
            className="flex-1"
          />
          <span className="w-12 text-center font-mono">{settings.sensitivity}%</span>
        </div>
        
        <p className="mt-2 text-sm text-gray-500">
          Higher sensitivity catches more but may have more false positives.
        </p>
      </section>

      {/* Custom Patterns */}
      <section className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-medium mb-4">Custom Patterns</h2>
        
        {/* Add new pattern */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newPattern.name}
            onChange={(e) => setNewPattern((p) => ({ ...p, name: e.target.value }))}
            placeholder="Pattern name"
            className="flex-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={newPattern.pattern}
            onChange={(e) => setNewPattern((p) => ({ ...p, pattern: e.target.value }))}
            placeholder="Regex pattern"
            className="flex-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm"
          />
          <button
            onClick={addPattern}
            disabled={!newPattern.name || !newPattern.pattern}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm"
          >
            Add
          </button>
        </div>
        
        {/* Pattern list */}
        {settings.customPatterns.length === 0 ? (
          <p className="text-sm text-gray-500">No custom patterns added yet.</p>
        ) : (
          <div className="space-y-2">
            {settings.customPatterns.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={() => togglePattern(p.id)}
                  className="w-4 h-4"
                />
                <span className="flex-1 text-sm">
                  <strong>{p.name}</strong>
                  <span className="ml-2 text-gray-400 font-mono text-xs">{p.pattern}</span>
                </span>
                <button
                  onClick={() => removePattern(p.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
