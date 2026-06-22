// A self-contained canvas heatmap that replaces the removed
// google.maps.visualization.HeatmapLayer (gone as of Maps JS v3.65).
//
// It is a google.maps.OverlayView that paints accumulated radial blobs to a
// canvas and colorizes them through a green→red gradient LUT — the same
// algorithm simpleheat/heatmap.js use. No external dependencies.
//
// NOTE: the class is created inside a factory because `extends
// google.maps.OverlayView` must run AFTER the Maps script has loaded.
// Evaluating it at module-import time (when `google` is undefined) would throw.

export interface HeatPoint {
  lat: number;
  lng: number;
  weight: number; // 0..1
}

export interface HeatmapOverlay {
  setPoints(points: HeatPoint[]): void;
  setMap(map: google.maps.Map | null): void;
}

// Build a 256-entry RGBA gradient lookup table (low confidence → high).
function buildGradientLUT(): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(0, 255, 0, 0)');
  grad.addColorStop(0.2, 'rgba(0, 255, 0, 1)');
  grad.addColorStop(0.4, 'rgba(173, 255, 47, 1)');
  grad.addColorStop(0.6, 'rgba(255, 255, 0, 1)');
  grad.addColorStop(0.8, 'rgba(255, 165, 0, 1)');
  grad.addColorStop(1.0, 'rgba(255, 0, 0, 1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1, 256);
  return ctx.getImageData(0, 0, 1, 256).data;
}

export function createHeatmapOverlay(
  initialPoints: HeatPoint[],
  options: { radius?: number; opacity?: number } = {}
): HeatmapOverlay {
  const radius = options.radius ?? 40;
  const opacity = options.opacity ?? 0.75;

  class CanvasHeatmap extends google.maps.OverlayView {
    private points: HeatPoint[];
    private canvas: HTMLCanvasElement | null = null;
    private gradient = buildGradientLUT();

    constructor(points: HeatPoint[]) {
      super();
      this.points = points;
    }

    setPoints(points: HeatPoint[]) {
      this.points = points;
      this.draw();
    }

    onAdd() {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.pointerEvents = 'none';
      canvas.style.willChange = 'transform';
      this.canvas = canvas;
      this.getPanes()?.overlayLayer.appendChild(canvas);
    }

    onRemove() {
      this.canvas?.parentNode?.removeChild(this.canvas);
      this.canvas = null;
    }

    draw() {
      const canvas = this.canvas;
      const projection = this.getProjection();
      const map = this.getMap() as google.maps.Map | null;
      if (!canvas || !projection || !map) return;

      const bounds = map.getBounds();
      if (!bounds) return;

      const div = map.getDiv() as HTMLElement;
      const width = div.offsetWidth;
      const height = div.offsetHeight;
      if (width === 0 || height === 0) return;

      // North-West corner anchors the canvas in div-pixel space.
      const nw = new google.maps.LatLng(
        bounds.getNorthEast().lat(),
        bounds.getSouthWest().lng()
      );
      const topLeft = projection.fromLatLngToDivPixel(nw);
      if (!topLeft) return;

      canvas.width = width;
      canvas.height = height;
      canvas.style.left = `${topLeft.x}px`;
      canvas.style.top = `${topLeft.y}px`;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // 1) Accumulate grayscale radial blobs (alpha = weight).
      for (const p of this.points) {
        const px = projection.fromLatLngToDivPixel(
          new google.maps.LatLng(p.lat, p.lng)
        );
        if (!px) continue;
        const x = px.x - topLeft.x;
        const y = px.y - topLeft.y;
        if (x < -radius || x > width + radius || y < -radius || y > height + radius) {
          continue;
        }
        const alpha = Math.max(0, Math.min(1, p.weight));
        const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
        g.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2) Colorize: map accumulated alpha → gradient color.
      const img = ctx.getImageData(0, 0, width, height);
      const data = img.data;
      const lut = this.gradient;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue;
        const o = a * 4;
        data[i] = lut[o];
        data[i + 1] = lut[o + 1];
        data[i + 2] = lut[o + 2];
        data[i + 3] = Math.round(Math.min(a, 255) * opacity);
      }
      ctx.putImageData(img, 0, 0);
    }
  }

  return new CanvasHeatmap(initialPoints) as unknown as HeatmapOverlay;
}
