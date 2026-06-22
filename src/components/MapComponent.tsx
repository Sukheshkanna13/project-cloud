import { useEffect, useRef, useState } from 'react';
import { useApi } from '../contexts/ApiContext';
import { NoiseRecord } from '../types';
import './MapStyles.css';

// Chennai, India — default center
const CHENNAI_CENTER = { lat: 13.0827, lng: 80.2707 };

declare global {
  interface Window {
    google: typeof google;
    googleMapsLoaded: boolean;
  }
}

const MapComponent = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
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
        zoom: 12,
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
      script.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsApiKey}&libraries=visualization,places&callback=urbannoise_init_google_maps`;
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

  // Update heatmap and markers when data changes
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;

    // ── Clear existing ──
    if (heatmapRef.current) {
      heatmapRef.current.setMap(null);
    }
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    if (noiseData.length === 0) return;

    // ── Heatmap layer ──
    const heatmapData = noiseData.map(point => ({
      location: new google.maps.LatLng(point.lat, point.lon),
      weight: point.confidence || 0.5,
    }));

    if (google.maps.visualization) {
      heatmapRef.current = new google.maps.visualization.HeatmapLayer({
        data: heatmapData,
        map: googleMapRef.current,
        gradient: [
          'rgba(0, 255, 0, 0)',
          'rgba(0, 255, 0, 1)',
          'rgba(173, 255, 47, 1)',
          'rgba(255, 255, 0, 1)',
          'rgba(255, 165, 0, 1)',
          'rgba(255, 69, 0, 1)',
          'rgba(255, 0, 0, 1)',
        ],
        opacity: 0.75,
        radius: 40,
      });
    }

    // ── Markers ──
    noiseData.forEach(point => {
      const marker = new google.maps.Marker({
        position: { lat: point.lat, lng: point.lon },
        map: googleMapRef.current,
        title: `${point.label} — ${point.node_id}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: getColor(point.confidence),
          fillOpacity: 0.85,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => setSelectedPoint(point));
      markersRef.current.push(marker);
    });

    // Auto-fit bounds to data
    if (noiseData.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      noiseData.forEach(p => bounds.extend({ lat: p.lat, lng: p.lon }));
      googleMapRef.current.fitBounds(bounds);
    } else if (noiseData.length === 1) {
      googleMapRef.current.setCenter({ lat: noiseData[0].lat, lng: noiseData[0].lon });
      googleMapRef.current.setZoom(14);
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

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3">
          <h4 className="font-semibold text-gray-900 text-sm mb-2">Confidence</h4>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-700">High (&gt;0.8)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-xs text-gray-700">Medium (0.5–0.8)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-xs text-gray-700">Low (&lt;0.5)</span>
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
              <div className="text-gray-500">Node ID</div>
              <div className="font-medium font-mono text-xs">{selectedPoint.node_id}</div>
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

function getColor(confidence: number): string {
  if (confidence > 0.8) return '#10B981';
  if (confidence > 0.5) return '#F59E0B';
  return '#EF4444';
}

export default MapComponent;