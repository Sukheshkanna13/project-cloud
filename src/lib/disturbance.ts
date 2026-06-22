// Disturbance classification — drives the heatmap color, NOT model confidence.
//
// The patent demo classifies each detected sound into a disturbance band:
//   red    = disruptive / hazardous (drilling, gun shot, jackhammer, horn)
//   yellow = intrusive but tolerable (dog bark, siren, engine idle)
//   green  = benign ambient (street music, children playing, A/C, ...)
//
// A sound's disturbance is a property of WHAT it is, independent of how
// confident the classifier was. So we map the label → band → a fixed weight
// and color that the heatmap renders.

export type Disturbance = 'red' | 'yellow' | 'green';

// Keyword matches against the normalized label. Order: red wins over yellow.
const RED_LABELS = [
  'drilling',
  'jackhammer',
  'gun_shot',
  'gunshot',
  'horn', // also matches car_horn
  'explosion',
  'siren_horn',
];
const YELLOW_LABELS = [
  'dog_bark',
  'dog_barking',
  'siren',
  'engine_idling',
  'engine_idle',
  'engine',
];
// Everything else (street_music, children_playing, air_conditioner, ...) → green.

function normalize(label: string): string {
  return String(label || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

export function classifyDisturbance(label: string): Disturbance {
  const l = normalize(label);
  if (!l || l === 'unknown' || l === 'processing_error') return 'green';
  if (RED_LABELS.some(k => l.includes(k))) return 'red';
  if (YELLOW_LABELS.some(k => l.includes(k))) return 'yellow';
  return 'green';
}

export interface DisturbanceMeta {
  weight: number; // heatmap intensity (NOT confidence)
  rgb: [number, number, number]; // diffusion field color
  hex: string; // marker / legend swatch
  text: string; // human label
}

export const DISTURBANCE_META: Record<Disturbance, DisturbanceMeta> = {
  red: { weight: 1.0, rgb: [239, 68, 68], hex: '#EF4444', text: 'High disturbance' },
  yellow: { weight: 0.6, rgb: [245, 158, 11], hex: '#F59E0B', text: 'Moderate disturbance' },
  green: { weight: 0.32, rgb: [16, 185, 129], hex: '#10B981', text: 'Low disturbance' },
};

export function disturbanceFor(label: string): DisturbanceMeta & { band: Disturbance } {
  const band = classifyDisturbance(label);
  return { band, ...DISTURBANCE_META[band] };
}
