// A self-contained canvas heatmap that replaces the removed
// google.maps.visualization.HeatmapLayer (gone as of Maps JS v3.65).
//
// It is a google.maps.OverlayView that paints a smooth, continuous DIFFUSION
// field rather than discrete heat spots. Each point contributes a large, blurred
// radial blob in its own disturbance color (red/yellow/green); the blobs are
// composited additively ('lighter') so neighbouring sources blend into a
// continuous gradient — loud red zones bleed into amber and fade to green,
// the way a real noise field diffuses through space.
//
// Color is driven by each point's `color` (its disturbance band), NOT by
// density. Intensity/brightness is driven by `weight`.
//
// NOTE: the class is created inside a factory because `extends
// google.maps.OverlayView` must run AFTER the Maps script has loaded.
// Evaluating it at module-import time (when `google` is undefined) would throw.

export interface HeatPoint {
  lat: number;
  lng: number;
  weight: number; // 0..1 intensity
  color?: [number, number, number]; // disturbance RGB; defaults to red
}

export interface HeatmapOverlay {
  setPoints(points: HeatPoint[]): void;
  setMap(map: google.maps.Map | null): void;
}

export function createHeatmapOverlay(
  initialPoints: HeatPoint[],
  options: { radius?: number; opacity?: number; blur?: number } = {}
): HeatmapOverlay {
  // Large radius + heavy blur = diffusion field, not pin-point spots.
  const radius = options.radius ?? 75;
  const opacity = options.opacity ?? 0.6;
  const blur = options.blur ?? Math.round(radius * 0.6);

  class CanvasHeatmap extends google.maps.OverlayView {
    private points: HeatPoint[];
    private canvas: HTMLCanvasElement | null = null;

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
      canvas.style.opacity = String(opacity);
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
      canvas.style.opacity = String(opacity);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Additive compositing + blur = smooth diffusion. Overlapping sources
      // sum their colors (red + green → amber) instead of stacking as discs.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = `blur(${blur}px)`;

      for (const p of this.points) {
        const px = projection.fromLatLngToDivPixel(
          new google.maps.LatLng(p.lat, p.lng)
        );
        if (!px) continue;
        const x = px.x - topLeft.x;
        const y = px.y - topLeft.y;
        const pad = radius + blur;
        if (x < -pad || x > width + pad || y < -pad || y > height + pad) continue;

        const [r, g, b] = p.color ?? [239, 68, 68];
        const a = Math.max(0, Math.min(1, p.weight));
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${a * 0.5})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  return new CanvasHeatmap(initialPoints) as unknown as HeatmapOverlay;
}
