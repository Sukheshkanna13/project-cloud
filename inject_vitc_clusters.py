import random
import time
import math
import struct
import wave
import io
import requests

# --- CONFIGURATION APPENDIX ---
API_ENDPOINT = "https://hnwl6n3tq1.execute-api.us-east-2.amazonaws.com/dev/predict"
NODE_ID = "ESP32-DEV-NODE"
SAMPLE_RATE = 16000

# Center coordinates: VIT Chennai Campus
CENTER_LAT = 12.8406
CENTER_LON = 80.1534

print(f"[*] Initializing Spatial Multi-Cluster Data Injector for VIT Chennai: {API_ENDPOINT}")

# ---------------------------------------------------------------------------
# IMPORTANT: the /predict Lambda CLASSIFIES the audio it receives. It ignores
# any label we send and decodes the WAV to compute label + confidence +
# noise_level, then writes them to DynamoDB. So we must send REAL, decodable
# 16-bit PCM audio (the old static mock buffer decoded to nothing -> the Lambda
# returned "processing_error" with 0 dB, which renders as an empty heatmap).
#
# We cannot force a specific label, but we CAN drive the stored decibel level
# by scaling the audio amplitude: louder synthetic clip -> higher noise_level.
# That gives each cluster a realistic loudness profile (construction loud,
# traffic medium, residential quiet) for heatmap evaluation.
#
# DynamoDB columns confirmed against the /dashboard read: lat, lng, label,
# confidence (0-100), noise_level (dB), event_id, timestamp, s3_path.
# The Lambda reads the coordinate form fields as `lat` and `lon`.
# ---------------------------------------------------------------------------


def amplitude_for_db(target_db):
    """Peak 16-bit amplitude that yields ~target_db (Lambda dB ~= 20*log10(amp))."""
    amp = int(10 ** (target_db / 20.0))
    return max(200, min(32000, amp))


def build_wav(target_db, freq, duration=1.0):
    """Generate a real 16-bit PCM mono WAV in memory, loudness tuned to target_db."""
    amp = amplitude_for_db(target_db)
    noise = max(1, int(amp * 0.15))
    buf = io.BytesIO()
    n = int(SAMPLE_RATE * duration)
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for i in range(n):
            v = int(amp * math.sin(2 * math.pi * freq * i / SAMPLE_RATE))
            v += random.randint(-noise, noise)  # texture so it is not a pure tone
            v = max(-32767, min(32767, v))
            frames += struct.pack("<h", v)
        w.writeframes(bytes(frames))
    buf.seek(0)  # rewind so requests reads the whole payload (was the old reuse bug)
    return buf


def transmit_event(lat, lon, target_db, freq, cluster):
    """POST one real audio clip through the live API Gateway -> Lambda -> DynamoDB."""
    wav = build_wav(target_db, freq)
    files = {"file": ("clip.wav", wav, "audio/wav")}
    # Field names the Lambda actually persists: node_id, lat, lon.
    data = {
        "node_id": NODE_ID,
        "lat": f"{lat:.6f}",
        "lon": f"{lon:.6f}",
    }

    try:
        response = requests.post(API_ENDPOINT, data=data, files=files, timeout=20)
        if response.status_code == 200:
            body = response.json()
            m = body.get("noise_metrics", {})
            label = m.get("label", "?")
            conf = m.get("confidence", "?")
            db = m.get("noise_level", "?")
            flag = "  <-- processing_error!" if label == "processing_error" else ""
            print(
                f" -> [{cluster:<12}] {label:<16} conf={conf:<5} {db} dB "
                f"@ {lat:.5f},{lon:.5f}{flag}"
            )
        else:
            print(f" -> Failed [{cluster}] HTTP {response.status_code}: {response.text[:120]}")
    except Exception as e:
        print(f" -> Error connecting to pipeline gateway: {str(e)}")

    time.sleep(0.3)  # smooth transaction rate


# =====================================================================
# CLUSTER 1: Internal Campus Construction (Tight Density, High Decibel)
# Simulates heavy equipment near the back blocks / hostels.
# =====================================================================
print("\n[1/3] Injecting High-Density Internal Campus Construction Cluster...")
for _ in range(15):
    lat = CENTER_LAT + random.uniform(-0.0008, 0.0008)
    lon = CENTER_LON + random.uniform(-0.0008, 0.0008)
    target_db = random.uniform(86, 90)        # loud
    freq = random.uniform(90, 180)            # low rumble (jackhammer/drilling)
    transmit_event(lat, lon, target_db, freq, "construction")

# =====================================================================
# CLUSTER 2: Vandalur-Kelambakkam Road Traffic (Linear, Medium-High dB)
# Linear corridor just outside the main gate, running roughly West-to-East.
# =====================================================================
print("\n[2/3] Injecting Linear Vandalur-Kelambakkam Road Traffic Corridor...")
for i in range(15):
    lat = (CENTER_LAT + 0.0025) + random.uniform(-0.0002, 0.0002)
    lon = (CENTER_LON - 0.005) + (i * 0.0007)  # step West -> East across the gate
    target_db = random.uniform(78, 85)         # medium-high
    freq = random.uniform(220, 420)            # horns / engine idle band
    transmit_event(lat, lon, target_db, freq, "traffic")

# =====================================================================
# CLUSTER 3: Surrounding Residential / Rural Pockets (Sparse, Lower Volumes)
# Scattered background noise out toward the open areas.
# =====================================================================
print("\n[3/3] Injecting Sparse Surrounding Residential Area Noise...")
for _ in range(15):
    lat = CENTER_LAT + random.uniform(-0.012, 0.012)
    lon = CENTER_LON + random.uniform(-0.012, 0.012)
    target_db = random.uniform(50, 64)         # quiet
    freq = random.uniform(300, 650)            # ambient / chatter band
    transmit_event(lat, lon, target_db, freq, "residential")

print("\n[+] Spatial Cluster Injection for VIT Chennai Completed Successfully.")
