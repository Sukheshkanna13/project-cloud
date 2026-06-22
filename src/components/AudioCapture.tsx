import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Upload, Loader, MapPin, CheckCircle } from 'lucide-react';
import { apiService } from '../services/api';
import { useApi } from '../contexts/ApiContext';

const AudioCapture = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { config, addLocalRecord } = useApi();
  const MAX_DURATION = 10; // seconds

  // Get location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => {
          // Default to Chennai
          setLocation({ lat: 13.0827, lon: 80.2707 });
        }
      );
    } else {
      setLocation({ lat: 13.0827, lon: 80.2707 });
    }
  }, []);

  const requestMicPermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setHasPermission(true);
      return true;
    } catch {
      setHasPermission(false);
      setError('Microphone access denied. Please allow microphone in browser settings.');
      return false;
    }
  };

  const startRecording = async () => {
    setError(null);
    setResult(null);

    if (hasPermission === null || hasPermission === false) {
      const granted = await requestMicPermission();
      if (!granted) return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      mediaRecorderRef.current = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);

      // Timer — auto-stop at MAX_DURATION
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_DURATION - 1) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setError('Failed to start recording. Check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAudio = async () => {
    if (!audioBlob || !location) {
      setError('No audio or location available');
      return;
    }
    if (!config.predictEndpoint) {
      setError('Predict endpoint not configured. Set it in Admin.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const response = await apiService.sendPrediction(audioBlob, location.lat, location.lon);
      setResult(response);
      setAudioBlob(null);

      // Parse response to add to local map immediately
      const parsedRecord = {
        node_id: 'local-browser',
        timestamp: new Date().toISOString(),
        confidence: Number(response.confidence) || 1.0,
        event_id: `local-${Date.now()}`,
        label: String(response.predicted_class || response.label || 'Unknown'),
        lat: location.lat,
        lon: location.lon,
      };
      
      addLocalRecord(parsedRecord);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Record & Classify</h2>
        {location && (
          <div className="flex items-center text-xs text-gray-500">
            <MapPin className="w-3 h-3 mr-1" />
            <span>{location.lat.toFixed(4)}, {location.lon.toFixed(4)}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Record Button */}
      <div className="flex flex-col items-center space-y-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isUploading}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
            isRecording
              ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
          } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isRecording ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
        </button>

        {isRecording && (
          <div className="text-center w-full">
            <div className="text-xl font-mono font-bold text-gray-900 mb-2">
              {recordingTime}s / {MAX_DURATION}s
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(recordingTime / MAX_DURATION) * 100}%` }}
              />
            </div>
          </div>
        )}

        {audioBlob && !isRecording && (
          <div className="text-center w-full space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-700 text-sm font-medium">
                Recording captured — {recordingTime}s
              </p>
            </div>
            <button
              onClick={uploadAudio}
              disabled={isUploading}
              className="inline-flex items-center space-x-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isUploading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Send to Predict</span>
                </>
              )}
            </button>
          </div>
        )}

        {result && (
          <div className="bg-gray-50 rounded-lg p-4 w-full">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-semibold text-gray-900">Prediction Result</h3>
            </div>
            <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center">
        Records up to {MAX_DURATION}s of audio, then sends .wav with GPS to the predict endpoint.
      </p>
    </div>
  );
};

export default AudioCapture;