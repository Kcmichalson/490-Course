// Picking and decoding map images. Uses the File System Access API in
// Chrome/Edge (keeps a file handle so Reload needs no picker), and falls back
// to a plain file input elsewhere. Pixels are decoded without color-space
// conversion so heightmap gray values stay exact.

import { MAX_SOURCE_WIDTH, MAX_SOURCE_HEIGHT } from '../sim/mapconfig.js';

const ACCEPT = { 'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.svg'] };
const DECODE = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };

// → { file, handle } or null if cancelled.
export async function pickImageFile() {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Map images', accept: ACCEPT }], multiple: false });
      return { file: await handle.getFile(), handle };
    } catch (err) {
      if (err.name === 'AbortError') return null;
      throw err;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.bmp,.svg';
    input.addEventListener('change', () => resolve(input.files[0] ? { file: input.files[0], handle: null } : null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

function isSvg(file) {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
}

// Natural size of an image file (SVGs without a size fall back to 4096 × 2048).
export async function imageSize(file) {
  if (isSvg(file)) {
    const img = await loadSvg(file);
    return { width: img.naturalWidth || 4096, height: img.naturalHeight || 2048 };
  }
  const bmp = await createImageBitmap(file, DECODE);
  const size = { width: bmp.width, height: bmp.height };
  bmp.close();
  return size;
}

function loadSvg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Couldn't read ${file.name}.`)); };
    img.src = url;
  });
}

// Largest size within the maximum map size, keeping the aspect ratio.
export function fitWithinMax(width, height, maxW = MAX_SOURCE_WIDTH, maxH = MAX_SOURCE_HEIGHT) {
  const scale = Math.min(1, maxW / width, maxH / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}

// Decodes to an ImageBitmap at the given size. quality 'pixelated' keeps
// hard edges (masks); 'high' smooths (downscaled heightmaps/art).
export async function decodeImage(file, width, height, quality = 'high') {
  if (isSvg(file)) {
    const img = await loadSvg(file);
    return createImageBitmap(img, { resizeWidth: width, resizeHeight: height, resizeQuality: quality });
  }
  return createImageBitmap(file, { ...DECODE, resizeWidth: width, resizeHeight: height, resizeQuality: quality });
}

// RGBA bytes of a bitmap drawn at width × height.
export function readPixels(bitmap, width = bitmap.width, height = bitmap.height) {
  const canvas = new OffscreenCanvas(width, height);
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(bitmap, 0, 0, width, height);
  return g.getImageData(0, 0, width, height).data;
}
