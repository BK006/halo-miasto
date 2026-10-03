// Photo preparation on the device, before anything leaves the phone:
// downscale → detect faces → pixelate them → JPEG data URL.

import type { FaceDetector } from "@mediapipe/tasks-vision";

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.82;

// Loaded from the CDN at runtime rather than bundled: the library imports its
// WASM loader via a dynamic import() that Turbopack cannot resolve. The npm
// package is kept for types only – keep both versions in sync.
const MEDIAPIPE_VERSION = "1.0.1";
const MEDIAPIPE_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const WASM_URL = `${MEDIAPIPE_BASE}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

let detectorPromise: Promise<FaceDetector | null> | null = null;

// Loaded lazily and warmed up early (see preloadFaceDetector) so the
// shutter-to-analysis path does not wait for the model download.
function getDetector(): Promise<FaceDetector | null> {
  detectorPromise ??= (async () => {
    try {
      const { FaceDetector, FilesetResolver } = (await import(
        /* webpackIgnore: true */ /* turbopackIgnore: true */ `${MEDIAPIPE_BASE}/vision_bundle.mjs`
      )) as typeof import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      return await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    } catch (err) {
      console.warn("Face detector unavailable", err);
      return null;
    }
  })();
  return detectorPromise;
}

export function preloadFaceDetector() {
  void getDetector();
}

export type PreparedPhoto = {
  dataUrl: string;
  facesBlurred: number;
  // false when the detector could not load – UI must not claim faces were blurred.
  faceCheckDone: boolean;
};

export async function preparePhoto(source: Blob | HTMLCanvasElement): Promise<PreparedPhoto> {
  const bitmap = source instanceof Blob ? await createImageBitmap(source) : source;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("close" in bitmap) bitmap.close();

  const detector = await getDetector();
  let facesBlurred = 0;
  if (detector) {
    const { detections } = detector.detect(canvas);
    for (const d of detections) {
      if (!d.boundingBox) continue;
      pixelate(ctx, d.boundingBox);
      facesBlurred++;
    }
  }

  return { dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY), facesBlurred, faceCheckDone: detector !== null };
}

// Pixelation instead of ctx.filter blur: works in every Safari version.
function pixelate(
  ctx: CanvasRenderingContext2D,
  box: { originX: number; originY: number; width: number; height: number },
) {
  const pad = 0.25;
  const x = Math.max(0, Math.round(box.originX - box.width * pad));
  const y = Math.max(0, Math.round(box.originY - box.height * pad));
  const w = Math.min(ctx.canvas.width - x, Math.round(box.width * (1 + 2 * pad)));
  const h = Math.min(ctx.canvas.height - y, Math.round(box.height * (1 + 2 * pad)));
  if (w <= 0 || h <= 0) return;

  const blocks = 8;
  const tiny = document.createElement("canvas");
  tiny.width = blocks;
  tiny.height = Math.max(1, Math.round((blocks * h) / w));
  const tctx = tiny.getContext("2d")!;
  tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, tiny.width, tiny.height);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, w, h);
  ctx.restore();
}
