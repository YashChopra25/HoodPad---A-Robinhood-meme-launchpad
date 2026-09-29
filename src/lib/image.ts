/**
 * Token images live on-chain in the contract's `image` field, so there is no
 * server or pinning service in the loop and nothing to go offline later.
 *
 * Storage is charged per 32-byte word, which makes an untouched phone photo
 * prohibitively expensive — so an upload is squared off, downscaled and
 * re-encoded until the data URI fits a budget.
 */

/** Roughly 12KB of data URI: a few hundred thousand gas on an L2. */
export const MAX_DATA_URI_BYTES = 12 * 1024;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const SIZES = [256, 192, 160, 128, 96, 64];
const QUALITIES = [0.82, 0.7, 0.6, 0.5, 0.4];

interface EncodedImage {
  uri: string;
  bytes: number;
  width: number;
}

/**
 * Reads a File into a square data URI small enough to store on-chain. Throws
 * with a readable message when even the smallest encoding is still too big.
 */
export async function fileToDataUri(file: File): Promise<EncodedImage> {
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image is larger than 8MB.");

  const source = await loadImage(file);
  const type = supportsWebp() ? "image/webp" : "image/jpeg";

  try {
    for (const size of SIZES) {
      const canvas = squareCanvas(source, size);
      for (const quality of QUALITIES) {
        const uri = canvas.toDataURL(type, quality);
        if (byteLength(uri) <= MAX_DATA_URI_BYTES) {
          return { uri, bytes: byteLength(uri), width: size };
        }
      }
    }
  } finally {
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) source.close();
  }

  throw new Error("Could not compress that image small enough. Try a simpler picture.");
}

type ImageSource = ImageBitmap | HTMLImageElement;

async function loadImage(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read that image."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Centre-crops to a square and draws it at `size`. */
function squareCanvas(source: ImageSource, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot process images.");
  ctx.imageSmoothingQuality = "high";

  const side = Math.min(source.width, source.height);
  ctx.drawImage(
    source,
    (source.width - side) / 2,
    (source.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  return canvas;
}

function supportsWebp(): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Public IPFS gateways, tried in order. ipfs.io rate-limits heavily, so it is
 * only a last resort.
 */
export const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
  "https://w3s.link/ipfs/",
  "https://ipfs.io/ipfs/",
];

/** Matches `ipfs://<path>` and `http(s)://<host>/ipfs/<path>` links. */
const IPFS_LINK = /^(?:ipfs:\/\/(?:ipfs\/)?|https?:\/\/[^/]+\/ipfs\/)(.+)$/i;

/**
 * Accepts data URIs plus http(s) and ipfs links; anything else is dropped.
 * IPFS links are served through IPFS_GATEWAYS[gateway], so a caller can retry
 * with the next gateway when one fails; past the last one this returns null.
 */
export function safeImageSrc(
  value: string | null | undefined,
  gateway = 0,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) {
    return gateway === 0 ? trimmed : null;
  }

  const ipfs = IPFS_LINK.exec(trimmed);
  if (ipfs) return gateway < IPFS_GATEWAYS.length ? IPFS_GATEWAYS[gateway] + ipfs[1] : null;

  if (/^https?:\/\//i.test(trimmed)) return gateway === 0 ? trimmed : null;
  return null;
}

/** Rough extra gas for storing `value` on-chain, at 20k per 32-byte word. */
export function storageGas(value: string): number {
  return Math.ceil(byteLength(value) / 32) * 20000 + 20000;
}

export function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
