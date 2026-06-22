// Matches DynamoDB table schema
export interface NoiseRecord {
  node_id: string;
  timestamp: string;
  confidence: number;
  event_id: string;
  label: string;
  lat: number;
  lon: number;
}

// API configuration for Admin panel
export interface ApiConfig {
  readEndpoint: string;    // GET endpoint to read noise data from DynamoDB
  predictEndpoint: string; // POST endpoint for audio prediction (ESP32 + browser)
  pollingInterval: number; // Polling interval in ms
  googleMapsApiKey: string; // Google Maps API key
}