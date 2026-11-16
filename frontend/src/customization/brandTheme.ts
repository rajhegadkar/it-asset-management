/**
 * Generates the brand colour scale (50–950) from one hex colour and publishes it as CSS variables
 * (`--brand-50` … `--brand-950`, as "r g b" triplets) consumed by tailwind.config.js.
 */
type RGB = [number, number, number];

const SHADES: Array<[number, number]> = [
  // [shade, mix]: negative = mix with white, positive = mix with black
  [50, -0.93],
  [100, -0.86],
  [200, -0.72],
  [300, -0.52],
  [400, -0.28],
  [500, -0.1],
  [600, 0],
  [700, 0.16],
  [800, 0.32],
  [900, 0.46],
  [950, 0.62],
];

export const DEFAULT_BRAND = '#4f46e5';

function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix(c: RGB, target: RGB, amount: number): RGB {
  return c.map((v, i) => Math.round(v + (target[i] - v) * amount)) as RGB;
}

export function brandScale(hex: string): Record<number, string> {
  const base = hexToRgb(hex) || (hexToRgb(DEFAULT_BRAND) as RGB);
  const out: Record<number, string> = {};
  for (const [shade, amt] of SHADES) {
    const c = amt < 0 ? mix(base, [255, 255, 255], -amt) : mix(base, [0, 0, 0], amt);
    out[shade] = c.join(' ');
  }
  return out;
}

export function applyBrandColor(hex?: string) {
  const scale = brandScale(hex || DEFAULT_BRAND);
  const root = document.documentElement;
  for (const [shade, rgb] of Object.entries(scale)) root.style.setProperty(`--brand-${shade}`, rgb);
  // keep the mobile browser toolbar in the brand colour
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = `rgb(${scale[600].replace(/ /g, ',')})`;
}

export function applySidebarColor(hex?: string) {
  const rgb = hexToRgb(hex || '') || [11, 16, 32];
  document.documentElement.style.setProperty('--sidebar', rgb.join(' '));
}
