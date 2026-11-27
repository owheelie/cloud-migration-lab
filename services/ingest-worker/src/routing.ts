// Same rule the content API uses: lowercase words separated by single hyphens.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ASSET_TYPES: Record<string, { folder: string; contentType: string }> = {
  png: { folder: "images", contentType: "image/png" },
  jpg: { folder: "images", contentType: "image/jpeg" },
  jpeg: { folder: "images", contentType: "image/jpeg" },
  webp: { folder: "images", contentType: "image/webp" },
  gif: { folder: "images", contentType: "image/gif" },
  pdf: { folder: "documents", contentType: "application/pdf" },
};

export type Route =
  | { kind: "content" }
  | { kind: "asset"; destKey: string; contentType: string }
  | { kind: "reject"; reason: string };

/** Decides where an uploaded file goes, based only on its key and size. */
export function planRoute(key: string, size: number): Route {
  if (!key.startsWith("incoming/")) return { kind: "reject", reason: "outside_incoming" };
  if (size > MAX_UPLOAD_BYTES) return { kind: "reject", reason: "too_large" };

  const filename = key.slice("incoming/".length);
  if (!SAFE_FILENAME.test(filename)) return { kind: "reject", reason: "unsafe_filename" };

  const dot = filename.lastIndexOf(".");
  if (dot === -1) return { kind: "reject", reason: "no_extension" };
  const ext = filename.slice(dot + 1).toLowerCase();

  if (ext === "json") return { kind: "content" };

  const asset = ASSET_TYPES[ext];
  if (!asset) return { kind: "reject", reason: "unsupported_type" };
  return { kind: "asset", destKey: `assets/${asset.folder}/${filename}`, contentType: asset.contentType };
}

export interface ContentDocument {
  slug: string;
  title: string;
  [field: string]: unknown;
}

/** Returns the document if it has a valid slug and a non-empty title, otherwise null. */
export function parseContentDocument(text: string): ContentDocument | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;

  const { slug, title } = data as Record<string, unknown>;
  if (typeof slug !== "string" || slug.length > 100 || !SLUG_PATTERN.test(slug)) return null;
  if (typeof title !== "string" || title.trim() === "") return null;
  return data as ContentDocument;
}
