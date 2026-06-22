import { useState } from 'react';
import {
  Settings,
  Database,
  Loader,
  CheckCircle,
  XCircle,
  RefreshCw,
  Radio,
  Plug,
} from 'lucide-react';
import { useApi } from '../contexts/ApiContext';
import { apiService } from '../services/api';

const Admin = () => {
  const {
    config,
    updateConfig,
    noiseData,
    isPolling,
    lastUpdated,
    error: contextError,
    startPolling,
    stopPolling,
    refreshData,
  } = useApi();

  const [readEndpoint, setReadEndpoint] = useState(config.readEndpoint);
  const [predictEndpoint, setPredictEndpoint] = useState(config.predictEndpoint);
  const [pollingInterval, setPollingInterval] = useState(config.pollingInterval / 1000);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState(config.googleMapsApiKey);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSave = () => {
    updateConfig({
      readEndpoint,
      predictEndpoint,
      pollingInterval: pollingInterval * 1000,
      googleMapsApiKey,
    });
    apiService.setConfig({
      readEndpoint,
      predictEndpoint,
      pollingInterval: pollingInterval * 1000,
      googleMapsApiKey,
    });
  };

  const handleTestRead = async () => {
    if (!readEndpoint) return;
    setTestStatus('testing');
    const ok = await apiService.testConnection(readEndpoint);
    setTestStatus(ok ? 'success' : 'error');
    setTimeout(() => setTestStatus('idle'), 4000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure endpoints and monitor data flow
        </p>
      </div>

      <div className="space-y-6">
        {/* ── Endpoint Configuration ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-5">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Endpoint Configuration</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                DynamoDB Read Endpoint
              </label>
              <div className="flex space-x-2">
                <input
                  type="url"
                  value={readEndpoint}
                  onChange={(e) => setReadEndpoint(e.target.value)}
                  placeholder="https://your-api-gateway.amazonaws.com/dev/data"
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleTestRead}
                  disabled={!readEndpoint || testStatus === 'testing'}
                  className="flex items-center space-x-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm"
                >
                  {testStatus === 'testing' ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : testStatus === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : testStatus === 'error' ? (
                    <XCircle className="w-4 h-4 text-red-600" />
                  ) : (
                    <Plug className="w-4 h-4" />
                  )}
                  <span>Test</span>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                GET endpoint that returns noise records from DynamoDB
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Predict Endpoint
              </label>
              <input
                type="url"
                value={predictEndpoint}
                onChange={(e) => setPredictEndpoint(e.target.value)}
                placeholder="https://hnwl6n3tq1.execute-api.us-east-2.amazonaws.com/dev/predict"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                POST endpoint for audio classification (ESP32 + browser recording)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Polling Interval (seconds)
              </label>
              <input
                type="number"
                min={5}
                max={300}
                value={pollingInterval}
                onChange={(e) => setPollingInterval(Number(e.target.value))}
                className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Maps API Key
              </label>
              <input
                type="text"
                value={googleMapsApiKey}
                onChange={(e) => setGoogleMapsApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Required to render the heatmap and map base layer.
              </p>
            </div>

            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Save Configuration
            </button>
          </div>
        </div>

        {/* ── Polling Status ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Radio className={`w-5 h-5 ${isPolling ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
              <h2 className="text-lg font-bold text-gray-900">Polling Status</h2>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || !config.readEndpoint}
                className="flex items-center space-x-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh Now</span>
              </button>
              <button
                onClick={isPolling ? stopPolling : startPolling}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isPolling
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {isPolling ? 'Stop Polling' : 'Start Polling'}
              </button>
            </div>
          </div>

          {contextError && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-amber-800 text-sm">{contextError}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Records Loaded</div>
              <div className="text-xl font-bold text-gray-900">{noiseData.length}</div>
            </div>
            <div>
              <div className="text-gray-500">Last Updated</div>
              <div className="font-medium text-gray-900">
                {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Interval</div>
              <div className="font-medium text-gray-900">{config.pollingInterval / 1000}s</div>
            </div>
          </div>
        </div>

        {/* ── Data Table ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Database className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">
              DynamoDB Records ({noiseData.length})
            </h2>
          </div>

          {noiseData.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Database className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No records loaded</p>
              <p className="text-xs mt-1">
                Configure the read endpoint above and start polling
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Node ID</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Timestamp</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Label</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Confidence</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Lat</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Lon</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Event ID</th>
                  </tr>
                </thead>
                <tbody>
                  {noiseData.slice(0, 50).map((record, idx) => (
                    <tr key={record.event_id || idx} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2 font-mono text-xs">{record.node_id}</td>
                      <td className="py-2 px-2 text-xs">
                        {new Date(record.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 px-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {record.label}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-medium">
                        {(record.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-2 font-mono text-xs">{record.lat?.toFixed(4)}</td>
                      <td className="py-2 px-2 font-mono text-xs">{record.lon?.toFixed(4)}</td>
                      <td className="py-2 px-2 font-mono text-xs">{record.event_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {noiseData.length > 50 && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Showing 50 of {noiseData.length} records
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;