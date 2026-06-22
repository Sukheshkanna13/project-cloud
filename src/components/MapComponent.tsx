import { useEffect, useRef, useState } from 'react';
import { useApi } from '../contexts/ApiContext';
import { NoiseRecord } from '../types';
import { createHeatmapOverlay, HeatmapOverlay } from '../lib/heatmapOverlay';
import { disturbanceFor } from '../lib/disturbance';
import './MapStyles.css';

// VIT Chennai campus — default center
const CHENNAI_CENTER = { lat: 12.8406, lng: 80.1534 };
const DEFAULT_ZOOM = 15;

declare global {
  interface Window {
    google: typeof google;
    googleMapsLoaded: boolean;
  }
}

const MapComponent = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const heatmapRef = useRef<HeatmapOverlay | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<NoiseRecord | null>(null);

  const { noiseData, config } = useApi();

  // Initialize Google Maps
  useEffect(() => {
    if (!config.googleMapsApiKey) {
      setMapError('Please configure your Google Maps API Key in the .env file or Admin panel.');
      setIsLoading(false);
      return;
    }

    const initMap = () => {
      if (!mapRef.current || !window.google?.maps) return;

      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center: CHENNAI_CENTER,
        zoom: DEFAULT_ZOOM,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        ],
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      });

      setIsLoading(false);
      setMapError(null);
    };

    if (window.google?.maps) {
      initMap();
      return;
    }

    // Set up callback
    window.googleMapsLoaded = false;
    (window as any).urbannoise_init_google_maps = () => {
      window.googleMapsLoaded = true;
      initMap();
    };

    // Inject the Google Maps script if not already there
    const existingScript = document.getElementById('google-maps-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsApiKey}&loading=async&callback=urbannoise_init_google_maps`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        setMapError('Google Maps API failed to load. Check your API key or network.');
        setIsLoading(false);
      };
      document.head.appendChild(script);
    } else {
      // Script is there, just poll for the object (HMR case)
      let attempts = 0;
      const maxAttempts = 75; // 15s
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.google?.maps) {
          clearInterval(checkInterval);
          initMap();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setMapError('Google Maps API timed out.');
          setIsLoading(false);
        }
      }, 200);
      return () => clearInterval(checkInterval);
    }
  }, [config.googleMapsApiKey]);

  // Update heatmap and markers when data changes.
  // Wrapped in try/catch so a single bad point can never white-screen the app.
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;

    try {
      // ── Clear existing markers ──
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      // Filter valid data points. Reject (0,0) — that's the "null island" the
      // backend stores when coordinates are missing, not a real sensor location.
      const validData = noiseData.filter(point =>
        point &&
        typeof point.lat === 'number' && !isNaN(point.lat) &&
        typeof point.lon === 'number' && !isNaN(point.lon) &&
        !(point.lat === 0 && point.lon === 0)
      );

      // ── Heatmap overlay (custom canvas — HeatmapLayer was removed in v3.65) ──
      // Color + weight come from the DISTURBANCE band of the sound (red/yellow/
      // green), not from model confidence. Drilling/horn glow red, dog/siren
      // amber, street music green.
      const heatPoints = validData.map(point => {
        const d = disturbanceFor(point.label);
        return { lat: point.lat, lng: point.lon, weight: d.weight, color: d.rgb };
      });

      if (!heatmapRef.current) {
        heatmapRef.current = createHeatmapOverlay(heatPoints, { radius: 80, opacity: 0.6 });
        heatmapRef.current.setMap(googleMapRef.current);
      } else {
        heatmapRef.current.setPoints(heatPoints);
      }

      if (validData.length === 0) return;

      // ── Markers ──
      validData.forEach(point => {
        try {
          const marker = new google.maps.Marker({
            position: { lat: point.lat, lng: point.lon },
            map: googleMapRef.current,
            title: `${point.label} — ${point.node_id}`,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: disturbanceFor(point.label).hex,
              fillOpacity: 0.9,
              strokeColor: '#fff',
              strokeWeight: 2,
            },
          });

          marker.addListener('click', () => setSelectedPoint(point));
          markersRef.current.push(marker);
        } catch (err) {
          console.error('Failed to create marker for point:', point, err);
        }
      });

      // Auto-fit bounds, but only to points near the configured campus center
      // (~12 km box). This keeps the view framed on VIT Chennai and ignores
      // far-away outliers/stale test records that would otherwise zoom the map
      // out across the whole region.
      const nearCampus = validData.filter(
        p => Math.abs(p.lat - CHENNAI_CENTER.lat) < 0.1 && Math.abs(p.lon - CHENNAI_CENTER.lng) < 0.1
      );
      const fitTarget = nearCampus.length > 0 ? nearCampus : validData;

      if (fitTarget.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        fitTarget.forEach(p => bounds.extend({ lat: p.lat, lng: p.lon }));
        googleMapRef.current.fitBounds(bounds);
      } else if (fitTarget.length === 1) {
        googleMapRef.current.setCenter({ lat: fitTarget[0].lat, lng: fitTarget[0].lon });
        googleMapRef.current.setZoom(DEFAULT_ZOOM);
      }
    } catch (err) {
      console.error('Failed to render map data:', err);
    }
  }, [noiseData]);

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden relative">
      {/* Map Error Overlay */}
      {mapError && (
        <div className="absolute inset-0 z-20 bg-white/90 p-8 flex flex-col items-center justify-center h-[500px]">
          <p className="text-red-600 font-medium mb-2">Map Error</p>
          <p className="text-gray-500 text-sm">{mapError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && !mapError && (
        <div className="absolute inset-0 z-10 bg-white/80 p-8 flex items-center justify-center h-[500px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="relative">
        <div ref={mapRef} className="map-container" style={{ height: '500px', width: '100%' }} />

        {/* Legend — disturbance level (not confidence) */}
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3">
          <h4 className="font-semibold text-gray-900 text-sm mb-2">Disturbance Level</h4>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-xs text-gray-700">High — drilling, horn, gun shot</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-xs text-gray-700">Moderate — dog bark, siren, engine</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-xs text-gray-700">Low — street music, ambient</span>
            </div>
          </div>
        </div>

        {/* Data Count */}
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2">
          <span className="text-sm font-medium text-gray-900">
            {noiseData.length} data point{noiseData.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Selected Point Info */}
      {selectedPoint && (
        <div className="p-4 border-t bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-900">Selected Point</h4>
            <button
              onClick={() => setSelectedPoint(null)}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Label</div>
              <div className="font-medium">{selectedPoint.label}</div>
            </div>
            <div>
              <div className="text-gray-500">Disturbance</div>
              <div
                className="font-medium inline-flex items-center px-2 py-0.5 rounded-full text-xs text-white"
                style={{ backgroundColor: disturbanceFor(selectedPoint.label).hex }}
              >
                {disturbanceFor(selectedPoint.label).text}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Confidence</div>
              <div className="font-medium">{(selectedPoint.confidence * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-gray-500">Timestamp</div>
              <div className="font-medium">{new Date(selectedPoint.timestamp).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;