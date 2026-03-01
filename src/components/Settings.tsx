/**
 * Settings - Configuration panel
 * SS-07: StreamShield Streamer Safety System
 */

import { useState, useEffect } from 'react';

export interface Settings {
  // Detection settings
  detectionEnabled: boolean;
  scanFps: number;
  confidenceThreshold: number;
  
  // Pattern categories
  enabledCategories: string[];
  
  // OBS settings
  obsAddress: string;
  obsPassword: string;
  autoSwitchScene: boolean;
  safeSceneName: string;
  
  // Action settings
  autoMute: boolean;
  autoBlur: boolean;
  autoBlock: boolean;
  killStreamDelay: number; // seconds
  
  // Notifications
  soundEnabled: boolean;
  desktopNotifications: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  detectionEnabled: true,
  scanFps: 2,
  confidenceThreshold: 0.7,
  enabledCategories: ['spam', 'hate', 'doxxing', 'personal'],
  obsAddress: 'localhost:4455',
  obsPassword: '',
  autoSwitchScene: true,
  safeSceneName: 'Safe Screen',
  autoMute: true,
  autoBlur: true,
  autoBlock: false,
  killStreamDelay: 5,
  soundEnabled: true,
  desktopNotifications: true,
};

const AVAILABLE_CATEGORIES = [
  { id: 'spam', name: 'Spam', description: 'Repeated messages, links, promotions' },
  { id: 'hate', name: 'Hate Speech', description: 'Racist, sexist, or discriminatory content' },
  { id: 'doxxing', name: 'Doxxing', description: 'Personal information leaks' },
  { id: 'personal', name: 'Personal Attacks', description: 'Targeted harassment' },
  { id: 'urls', name: 'Suspicious URLs', description: 'Potentially malicious links' },
  { id: 'caps', name: 'All Caps Spam', description: 'Excessive capitalization' },
];

export function Settings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('streamshield-settings');
    if (stored) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      } catch {
        // Use defaults if parse fails
      }
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = () => {
    localStorage.setItem('streamshield-settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleCategory = (categoryId: string) => {
    setSettings(prev => ({
      ...prev,
      enabledCategories: prev.enabledCategories.includes(categoryId)
        ? prev.enabledCategories.filter(c => c !== categoryId)
        : [...prev.enabledCategories, categoryId],
    }));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">⚙️ Settings</h1>
        <p className="text-gray-400">Configure StreamShield</p>
      </header>

      <div className="max-w-2xl space-y-6">
        {/* Detection Settings */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Detection</h2>
          
          <div className="space-y-4">
            <label items-center justify-between className="flex">
              <span>Enable Detection</span>
              <input
                type="checkbox"
                checked={settings.detectionEnabled}
                onChange={e => updateSetting('detectionEnabled', e.target.checked)}
                className="w-5 h-5"
              />
            </label>

            <label className="block">
              <span className="text-gray-400">Scan FPS: {settings.scanFps}</span>
              <input
                type="range"
                min="1"
                max="10"
                value={settings.scanFps}
                onChange={e => updateSetting('scanFps', parseInt(e.target.value))}
                className="w-full mt-1"
              />
            </label>

            <label className="block">
              <span className="text-gray-400">Confidence Threshold: {Math.round(settings.confidenceThreshold * 100)}%</span>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={settings.confidenceThreshold}
                onChange={e => updateSetting('confidenceThreshold', parseFloat(e.target.value))}
                className="w-full mt-1"
              />
            </label>
          </div>
        </section>

        {/* Pattern Categories */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Pattern Categories</h2>
          
          <div className="space-y-2">
            {AVAILABLE_CATEGORIES.map(cat => (
              <label
                key={cat.id}
                className="flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600"
              >
                <div>
                  <div className="font-medium">{cat.name}</div>
                  <div className="text-sm text-gray-400">{cat.description}</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enabledCategories.includes(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                  className="w-5 h-5"
                />
              </label>
            ))}
          </div>
        </section>

        {/* OBS Settings */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">OBS Studio</h2>
          
          <div className="space-y-4">
            <label className="block">
              <span className="text-gray-400">WebSocket Address</span>
              <input
                type="text"
                value={settings.obsAddress}
                onChange={e => updateSetting('obsAddress', e.target.value)}
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-3 py-2"
                placeholder="localhost:4455"
              />
            </label>

            <label className="block">
              <span className="text-gray-400">Password (optional)</span>
              <input
                type="password"
                value={settings.obsPassword}
                onChange={e => updateSetting('obsPassword', e.target.value)}
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </label>

            <label className="flex items-center justify-between">
              <span>Auto-switch to Safe Scene</span>
              <input
                type="checkbox"
                checked={settings.autoSwitchScene}
                onChange={e => updateSetting('autoSwitchScene', e.target.checked)}
                className="w-5 h-5"
              />
            </label>

            {settings.autoSwitchScene && (
              <label className="block">
                <span className="text-gray-400">Safe Scene Name</span>
                <input
                  type="text"
                  value={settings.safeSceneName}
                  onChange={e => updateSetting('safeSceneName', e.target.value)}
                  className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </label>
            )}
          </div>
        </section>

        {/* Action Settings */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Automated Actions</h2>
          
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span>Auto-mute on threat</span>
              <input
                type="checkbox"
                checked={settings.autoMute}
                onChange={e => updateSetting('autoMute', e.target.checked)}
                className="w-5 h-5"
              />
            </label>

            <label className="flex items-center justify-between">
              <span>Auto-blur on threat</span>
              <input
                type="checkbox"
                checked={settings.autoBlur}
                onChange={e => updateSetting('autoBlur', e.target.checked)}
                className="w-5 h-5"
              />
            </label>

            <label className="flex items-center justify-between">
              <span>Auto-block user</span>
              <input
                type="checkbox"
                checked={settings.autoBlock}
                onChange={e => updateSetting('autoBlock', e.target.checked)}
                className="w-5 h-5"
              />
            </label>

            <label className="block">
              <span className="text-gray-400">Kill stream delay (seconds): {settings.killStreamDelay}</span>
              <input
                type="range"
                min="3"
                max="30"
                value={settings.killStreamDelay}
                onChange={e => updateSetting('killStreamDelay', parseInt(e.target.value))}
                className="w-full mt-1"
              />
            </label>
          </div>
        </section>

        {/* Notifications */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Notifications</h2>
          
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span>Sound alerts</span>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={e => updateSetting('soundEnabled', e.target.checked)}
                className="w-5 h-5"
              />
            </label>

            <label className="flex items-center justify-between">
              <span>Desktop notifications</span>
              <input
                type="checkbox"
                checked={settings.desktopNotifications}
                onChange={e => updateSetting('desktopNotifications', e.target.checked)}
                className="w-5 h-5"
              />
            </label>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={saveSettings}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
          >
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
          
          <button
            onClick={() => setSettings(DEFAULT_SETTINGS)}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
