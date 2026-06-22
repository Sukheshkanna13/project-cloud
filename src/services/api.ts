// src/services/api.ts
import { NoiseRecord, ApiConfig } from '../types';

const DEFAULT_CONFIG: ApiConfig = {
  readEndpoint: '',
  predictEndpoint: 'https://hnwl6n3tq1.execute-api.us-east-2.amazonaws.com/dev/predict',
  pollingInterval: 30000,
  googleMapsApiKey: '',
};

class ApiService {
  private config: ApiConfig = DEFAULT_CONFIG;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  setConfig(config: Partial<ApiConfig>) {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ApiConfig {
    return { ...this.config };
  }

  // ── Read noise data from DynamoDB (via API Gateway GET endpoint) ──
  async fetchNoiseData(): Promise<NoiseRecord[]> {
    if (!this.config.readEndpoint) {
      console.warn('DynamoDB read endpoint not configured');
      return [];
    }

    try {
      const response = await fetch(this.config.readEndpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle different response shapes — array directly or wrapped in body
      if (Array.isArray(data)) {
        return data as NoiseRecord[];
      }
      if (data.body) {
        const parsed = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch noise data:', error);
      throw error;
    }
  }

  // ── Send audio recording to predict endpoint ──
  async sendPrediction(
    audioBlob: Blob,
    lat: number,
    lon: number
  ): Promise<Record<string, unknown>> {
    if (!this.config.predictEndpoint) {
      throw new Error('Predict endpoint not configured');
    }

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('latitude', String(lat));
      formData.append('longitude', String(lon));
      formData.append('timestamp', new Date().toISOString());

      const response = await fetch(this.config.predictEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to send prediction:', error);
      throw error;
    }
  }

  // ── Test endpoint connectivity ──
  async testConnection(endpoint: string): Promise<boolean> {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ── Polling ──
  startPolling(callback: (data: NoiseRecord[]) => void): void {
    this.stopPolling();

    // Immediate first fetch
    this.fetchNoiseData()
      .then(callback)
      .catch(() => {});

    this.pollingTimer = setInterval(async () => {
      try {
        const data = await this.fetchNoiseData();
        callback(data);
      } catch {
        // Silently continue polling on failure
      }
    }, this.config.pollingInterval);
  }

  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  isPolling(): boolean {
    return this.pollingTimer !== null;
  }
}

export const apiService = new ApiService();