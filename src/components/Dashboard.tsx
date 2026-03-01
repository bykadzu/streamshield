/**
 * Dashboard - Main control panel UI
 * SS-06: StreamShield Streamer Safety System
 */

import { useState, useEffect } from 'react';
import { detectionLog, type DetectionEvent, type LogStats } from './lib/detection/DetectionLog';
import { DetectionPipeline } from './lib/detection/DetectionPipeline';
import { OBSClient } from './lib/obs/OBSClient';

export function Dashboard() {
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [stats, setStats] = useState<LogStats>({ total: 0, threats: 0, warnings: 0, resolved: 0, unresolved: 0 });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [obsConnected, setObsConnected] = useState(false);
  const [currentScene, setCurrentScene] = useState<string>('');

  // Initialize OBS client
  const [obs] = useState(() => new OBSClient({
    address: 'localhost:4455',
    password: undefined,
    onConnect: () => setObsConnected(true),
    onDisconnect: () => setObsConnected(false),
  }));

  // Initialize detection pipeline
  const [pipeline] = useState(() => new DetectionPipeline({
    ocrWorker: undefined, // Will be initialized when needed
    patternConfig: '/patterns/default.json',
    onDetection: (event) => {
      detectionLog.log(event);
    },
    onAction: async (action) => {
      console.log('Action triggered:', action);
      // Handle OBS actions here
    },
  }));

  useEffect(() => {
    // Load initial events and stats
    setEvents(detectionLog.getEvents({ limit: 50 }));
    setStats(detectionLog.getStats());

    // Subscribe to new events
    const unsubscribe = detectionLog.subscribe((event) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      setStats(detectionLog.getStats());
    });

    return () => unsubscribe();
  }, []);

  const toggleMonitoring = async () => {
    if (isMonitoring) {
      pipeline.stop();
      setIsMonitoring(false);
    } else {
      await pipeline.start();
      setIsMonitoring(true);
    }
  };

  const connectOBS = async () => {
    try {
      await obs.connect();
      const scene = await obs.getCurrentScene();
      setCurrentScene(scene);
    } catch (err) {
      console.error('Failed to connect to OBS:', err);
    }
  };

  const resolveEvent = (eventId: string) => {
    detectionLog.resolve(eventId);
    setEvents(detectionLog.getEvents({ limit: 50 }));
    setStats(detectionLog.getStats());
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'kill': return 'bg-red-600';
      case 'block': return 'bg-red-500';
      case 'blur': return 'bg-orange-500';
      case 'mute': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🛡️ StreamShield</h1>
        <p className="text-gray-400">Streamer Safety System</p>
      </header>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Total Events</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Threats</div>
          <div className="text-2xl font-bold text-red-400">{stats.threats}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Warnings</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.warnings}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Resolved</div>
          <div className="text-2xl font-bold text-green-400">{stats.resolved}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Monitoring Control */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Monitoring</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleMonitoring}
              className={`px-6 py-2 rounded-lg font-semibold ${
                isMonitoring 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isMonitoring ? '⏹ Stop' : '▶ Start'}
            </button>
            <span className={isMonitoring ? 'text-green-400' : 'text-gray-400'}>
              {isMonitoring ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* OBS Connection */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">OBS Studio</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={connectOBS}
              disabled={obsConnected}
              className={`px-6 py-2 rounded-lg font-semibold ${
                obsConnected 
                  ? 'bg-green-600 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {obsConnected ? '✓ Connected' : 'Connect'}
            </button>
            {currentScene && (
              <span className="text-gray-400">
                Scene: {currentScene}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Detection Log</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-gray-400">No events yet</p>
          ) : (
            events.map(event => (
              <div
                key={event.id}
                className={`flex items-center justify-between bg-gray-700 rounded-lg p-3 ${
                  event.resolved ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getSeverityColor(event.severity)}`}>
                    {event.severity.toUpperCase()}
                  </span>
                  <span className="text-sm">
                    <span className="text-gray-400">[{event.pattern}]</span>{' '}
                    {event.matchedText}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  {!event.resolved && (
                    <button
                      onClick={() => resolveEvent(event.id)}
                      className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
