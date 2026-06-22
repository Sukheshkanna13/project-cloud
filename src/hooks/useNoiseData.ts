import { useState, useEffect, useCallback } from 'react';

const API_ENDPOINT = "https://hnwl6n3tq1.execute-api.us-east-2.amazonaws.com/dev/dashboard";

export interface DashboardNoiseRecord {
  event_id: string;
  timestamp: string;
  label: string;
  confidence: number;
  noise_level: number;
  lat: number;
  lng: number;
}

export function useNoiseData(targetNode = "ESP32-DEV-NODE", lookbackHours = 24) {
  const [data, setData] = useState<DashboardNoiseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      // Explicit Query constraints to reduce DynamoDB Read Unit usage
      const targetUrl = `${API_ENDPOINT}?node_id=${targetNode}&hours=${lookbackHours}&limit=50`;
      
      const response = await fetch(targetUrl, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`HTTP Error Status: ${response.status}`);
      }

      const payload = await response.json();
      setData(payload.data || []);
      setError(null);
    } catch (err) {
      console.error("Dashboard fetch operation failure:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [targetNode, lookbackHours]);

  // Handle fetching lifecycle hooks
  useEffect(() => {
    fetchMetrics();
    
    // Low-cost testing interval: updates once every 30 seconds while open
    const pollInterval = setInterval(fetchMetrics, 30000);
    
    return () => clearInterval(pollInterval);
  }, [fetchMetrics]);

  return { data, loading, error, refresh: fetchMetrics };
}
