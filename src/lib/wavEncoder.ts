// Convert a browser MediaRecorder blob (WebM/Opus on Chrome, MP4/AAC on Safari)
// into a real 16-bit PCM mono WAV that the predict Lambda can decode.
//
// MediaRecorder never produces actual WAV — relabeling its output `audio/wav`
// gives the backend an Opus stream with a .wav name, which fails to decode and
// always returns `processing_error`. We decode via Web Audio, downmix to mono,
// and write a proper RIFF/WAVE container.

export async function encodeWavFromBlob(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();

  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();

  let audioBuffer: AudioBuffer;
  try {
    // decodeAudioData handles Opus/AAC/etc. in modern browsers.
    audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  } finally {
    // Release the context regardless of success.
    void ctx.close();
  }

  // Downmix all channels to mono.
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < channels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / channels;
    }
  }

  const wav = encodeWav(mono, audioBuffer.sampleRate);
  return new Blob([wav], { type: 'audio/wav' });
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataSize = samples.length * 2; // 16-bit
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // audio format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * blockAlign)
  view.setUint16(32, 2, true); // block align (channels * bytesPerSample)
  view.setUint16(34, 16, true); // bits per sample
  // data chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}
