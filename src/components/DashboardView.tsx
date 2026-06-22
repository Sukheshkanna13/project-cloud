import React from 'react';
import { useNoiseData } from '../hooks/useNoiseData';

export default function DashboardView() {
  // Pull metrics matching your active testing parameters
  const { data, loading, error, refresh } = useNoiseData("ESP32-DEV-NODE", 24);

  if (loading && data.length === 0) return <p style={{color: '#fff'}}>Ingesting cloud records...</p>;
  if (error) return <p style={{color: '#ff4d4d'}}>Pipeline Reading Interrupted: {error}</p>;

  return (
    <div style={{ padding: '20px', background: '#1e1e24', color: '#fff', borderRadius: '8px', margin: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>🔊 Urban Noise Integration Logs</h2>
        <button onClick={refresh} style={{ padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', background: '#4a90e2', color: '#fff', border: 'none' }}>
          Manual Sync
        </button>
      </div>

      {/* Test Metric Highlights */}
      <div style={{ display: 'flex', gap: '20px', margin: '20px 0' }}>
        <div style={{ background: '#2a2a35', padding: '15px', borderRadius: '6px', flex: 1 }}>
          <h4>Total Event Records Collected (24h)</h4>
          <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4af2a1' }}>{data.length}</span>
        </div>
        <div style={{ background: '#2a2a35', padding: '15px', borderRadius: '6px', flex: 1 }}>
          <h4>Latest Classification Result</h4>
          <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f5a623' }}>
            {data[0] ? data[0].label.toUpperCase() : "NO DATA"}
          </span>
        </div>
      </div>

      {/* Raw Metadata Validation Feed */}
      <h3>🔬 Live Verification Stream</h3>
      <div style={{ maxHeight: '300px', overflowY: 'auto', background: '#111', padding: '10px', borderRadius: '4px' }}>
        {data.length === 0 ? (
          <p style={{color: '#888'}}>No recent test iterations recorded in DynamoDB.</p>
        ) : (
          <table style={{ width: '100%', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ color: '#888' }}>
                <th>Timestamp</th>
                <th>Classification</th>
                <th>Confidence</th>
                <th>Amplitude (dB)</th>
                <th>Coordinates (Lat/Lng)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.event_id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '6px 0' }}>{new Date(item.timestamp).toLocaleTimeString()}</td>
                  <td style={{ color: item.label === 'processing_error' ? '#ff4d4d' : '#4af2a1' }}>{item.label}</td>
                  <td>{item.confidence}%</td>
                  <td>{item.noise_level || 0} dB</td>
                  <td style={{ fontSize: '12px', color: '#aaa' }}>{item.lat}, {item.lng}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
