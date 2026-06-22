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
      // Append query params if they don't exist to reduce DynamoDB Read Unit usage
      let fetchUrl = this.config.readEndpoint;
      if (!fetchUrl.includes('?')) {
        fetchUrl += '?node_id=ESP32-DEV-NODE&hours=24&limit=50';
      }

      const response = await fetch(fetchUrl, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawData = await response.json();
      
      let items: any[] = [];
      // Handle different response shapes
      if (Array.isArray(rawData)) {
        items = rawData;
      } else if (rawData.data && Array.isArray(rawData.data)) {
        items = rawData.data;
      } else if (rawData.body) {
        const parsed = typeof rawData.body === 'string' ? JSON.parse(rawData.body) : rawData.body;
        items = Array.isArray(parsed) ? parsed : [];
      }

      // Normalize each record to the internal NoiseRecord shape:
      //  - map 'lng' → 'lon'
      //  - coerce coordinates to numbers
      //  - normalize confidence to a 0–1 fraction (API may send 0–100)
      return items.map((item: any) => {
        const rawConfidence = Number(item.confidence);
        const confidence = !isFinite(rawConfidence)
          ? 0.5
          : rawConfidence > 1
          ? Math.min(rawConfidence / 100, 1)
          : rawConfidence;
        return {
          ...item,
          lat: Number(item.lat),
          lon: Number(item.lon !== undefined ? item.lon : item.lng),
          confidence,
        };
      }) as NoiseRecord[];
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
      formData.append('file', audioBlob, 'recording.wav');
      // The predict Lambda persists the coordinate fields named `lat`/`lon`.
      // Sending `latitude`/`longitude` makes it store 0,0 in DynamoDB.
      formData.append('lat', String(lat));
      formData.append('lon', String(lon));
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