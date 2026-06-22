import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { NoiseRecord, ApiConfig } from '../types';
import { apiService } from '../services/api';

interface ApiContextType {
  config: ApiConfig;
  updateConfig: (config: Partial<ApiConfig>) => void;
  noiseData: NoiseRecord[];
  isPolling: boolean;
  lastUpdated: Date | null;
  error: string | null;
  startPolling: () => void;
  stopPolling: () => void;
  refreshData: () => Promise<void>;
  addLocalRecord: (record: NoiseRecord) => void;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};

export const ApiProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<ApiConfig>(() => {
    const defaultEnvKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const defaultReadEndpoint = import.meta.env.VITE_READ_ENDPOINT || '';
    const saved = localStorage.getItem('urbanNoiseConfig');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // If local storage has no key, inject the .env key
        if (!parsed.googleMapsApiKey) {
          parsed.googleMapsApiKey = defaultEnvKey;
        }
        if (!parsed.readEndpoint) {
          parsed.readEndpoint = defaultReadEndpoint;
        }
        return parsed;
      } catch {
        // Fall through to defaults
      }
    }
    return {
      readEndpoint: defaultReadEndpoint,
      predictEndpoint: 'https://hnwl6n3tq1.execute-api.us-east-2.amazonaws.com/dev/predict',
      pollingInterval: 30000,
      googleMapsApiKey: defaultEnvKey,
    };
  });

  const [noiseData, setNoiseData] = useState<NoiseRecord[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync config to apiService and localStorage
  useEffect(() => {
    apiService.setConfig(config);
    localStorage.setItem('urbanNoiseConfig', JSON.stringify(config));
  }, [config]);

  const updateConfig = useCallback((partial: Partial<ApiConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
  }, []);

  const handleDataUpdate = useCallback((data: NoiseRecord[]) => {
    setNoiseData(data);
    setLastUpdated(new Date());
    setError(null);
  }, []);

  const addLocalRecord = useCallback((record: NoiseRecord) => {
    setNoiseData(prev => {
      // Check if it already exists based on event_id, otherwise append
      if (prev.some(r => r.event_id === record.event_id)) {
        return prev;
      }
      return [record, ...prev];
    });
    setLastUpdated(new Date());
  }, []);

  const startPolling = useCallback(() => {
    if (!config.readEndpoint) {
      setError('Configure a DynamoDB read endpoint in Admin to start polling.');
      return;
    }
    apiService.startPolling(handleDataUpdate);
    setIsPolling(true);
    setError(null);
  }, [config.readEndpoint, handleDataUpdate]);

  const stopPolling = useCallback(() => {
    apiService.stopPolling();
    setIsPolling(false);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const data = await apiService.fetchNoiseData();
      handleDataUpdate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    }
  }, [handleDataUpdate]);

  // Auto-start polling if endpoint is configured
  useEffect(() => {
    if (config.readEndpoint) {
      startPolling();
    }
    return () => {
      apiService.stopPolling();
    };
  }, [config.readEndpoint, config.pollingInterval, startPolling]);

  return (
    <ApiContext.Provider
      value={{
        config,
        updateConfig,
        noiseData,
        isPolling,
        lastUpdated,
        error,
        startPolling,
        stopPolling,
        refreshData,
        addLocalRecord,
      }}
    >
      {children}
    </ApiContext.Provider>
  );
};