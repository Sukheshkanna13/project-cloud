import { Activity, Radio, Clock } from 'lucide-react';
import MapComponent from '../components/MapComponent';
import AudioCapture from '../components/AudioCapture';
import { useApi } from '../contexts/ApiContext';

const Dashboard = () => {
  const { noiseData, isPolling, lastUpdated, error, config } = useApi();

  // Compute stats from live data
  const uniqueLabels = [...new Set(noiseData.map(d => d.label))];
  const avgConfidence =
    noiseData.length > 0
      ? noiseData.reduce((sum, d) => sum + d.confidence, 0) / noiseData.length
      : 0;
  const latestRecord = noiseData.length > 0
    ? noiseData.reduce((latest, d) =>
        new Date(d.timestamp) > new Date(latest.timestamp) ? d : latest
      )
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Noise Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real-time noise classification from ESP32 edge devices
        </p>
      </div>

      {/* Setup Guide */}
      {!config.readEndpoint && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm font-medium mb-1">Setup Required</p>
          <p className="text-blue-700 text-sm">
            Go to <a href="/admin" className="underline font-medium">Admin Panel</a> and configure your DynamoDB read endpoint to start receiving live data.
            The predict endpoint is already set to your AWS API Gateway.
          </p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          <p className="text-amber-800 text-sm">{error}</p>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center space-x-2 text-gray-500 text-xs mb-1">
            <Radio className={`w-3 h-3 ${isPolling ? 'text-green-500' : 'text-gray-400'}`} />
            <span>Status</span>
          </div>
          <div className={`text-lg font-bold ${isPolling ? 'text-green-600' : (!config.readEndpoint ? 'text-amber-500' : 'text-gray-400')}`}>
            {isPolling ? 'Live' : (!config.readEndpoint ? 'Not Configured' : 'Offline')}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center space-x-2 text-gray-500 text-xs mb-1">
            <Activity className="w-3 h-3" />
            <span>Data Points</span>
          </div>
          <div className="text-lg font-bold text-gray-900">{noiseData.length}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="text-gray-500 text-xs mb-1">Avg Confidence</div>
          <div className="text-lg font-bold text-blue-600">
            {avgConfidence > 0 ? `${(avgConfidence * 100).toFixed(1)}%` : '—'}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center space-x-2 text-gray-500 text-xs mb-1">
            <Clock className="w-3 h-3" />
            <span>Last Update</span>
          </div>
          <div className="text-sm font-bold text-gray-900">
            {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
          </div>
        </div>
      </div>

      {/* Labels summary */}
      {uniqueLabels.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {uniqueLabels.map(label => {
            const count = noiseData.filter(d => d.label === label).length;
            return (
              <span
                key={label}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
              >
                {label} · {count}
              </span>
            );
          })}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Map — 2/3 */}
        <div className="xl:col-span-2">
          <MapComponent />
        </div>

        {/* Sidebar — 1/3 */}
        <div className="xl:col-span-1 space-y-6">
          <AudioCapture />

          {/* Latest Record */}
          {latestRecord && (
            <div className="bg-white rounded-xl shadow-lg p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Latest Classification</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Label</span>
                  <span className="font-medium">{latestRecord.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Node</span>
                  <span className="font-mono text-xs">{latestRecord.node_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Confidence</span>
                  <span className="font-medium">{(latestRecord.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span className="text-xs">{new Date(latestRecord.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;