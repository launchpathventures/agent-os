/**
 * Ditto — Workspace Asset Storage (Supabase Storage)
 *
 * Generated images, screen recordings, and media stored in Supabase Storage.
 * Metadata tracked in workspace_assets DB table.
 * Falls back to local data/assets/ if Supabase is not configured.
 *
 * Provenance: Brief 141 (automated publishing), Supabase Storage SDK (depend).
 */

import fs from "fs";
import path from "path";
import { randomUUID, createHash } from "crypto";
import { db, schema } from "../db";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "assets";
const LOCAL_ASSETS_DIR = path.resolve(process.cwd(), "data", "assets");

// ============================================================
// Supabase client (singleton)
// ============================================================

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) return null;

  supabaseClient = createClient(url, key);
  return supabaseClient;
}

function isSupabaseConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY;
}

// ============================================================
// Types
// ============================================================

export interface SaveAssetInput {
  /** Raw file buffer */
  buffer: Buffer;
  /** Human-readable name */
  name: string;
  /** MIME type */
  mimeType: string;
  /** How it was created */
  source: "generated" | "uploaded" | "screenshot";
  /** Generation prompt (if AI-generated) */
  prompt?: string;
  /** Process run ID (if from a cycle) */
  processRunId?: string;
}

export interface SavedAsset {
  id: string;
  /** For Supabase: public URL. For local: absolute file path. */
  filePath: string;
  /** Public URL (only set for Supabase storage) */
  publicUrl?: string;
  contentHash: string;
}

// ============================================================
// Save asset
// ============================================================

/**
 * Save an asset to Supabase Storage (or local fallback) and record in DB.
 * Returns the asset ID, file path/URL, and content hash.
 */
export async function saveAsset(input: SaveAssetInput): Promise<SavedAsset> {
  const id = randomUUID();
  const ext = mimeToExt(input.mimeType);
  const fileName = `${id}${ext}`;
  const contentHash = createHash("sha256").update(input.buffer).digest("hex");

  const supabase = getSupabase();

  if (supabase) {
    // Upload to Supabase Storage
    const storagePath = `workspace/${fileName}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, input.buffer, {
        contentType: input.mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Also save locally for X API upload (needs file buffer, not URL)
    ensureLocalDir();
    const localPath = path.join(LOCAL_ASSETS_DIR, fileName);
    fs.writeFileSync(localPath, input.buffer);

    // Record in DB
    await db.insert(schema.workspaceAssets).values({
      id,
      assetType: input.mimeType.startsWith("video/") ? "video" : "image",
      name: input.name,
      mimeType: input.mimeType,
      fileSize: input.buffer.length,
      storagePath: publicUrl, // Store the public URL
      source: input.source,
      prompt: input.prompt,
      processRunId: input.processRunId,
      contentHash,
    });

    return { id, filePath: localPath, publicUrl, contentHash };
  }

  // Fallback: local storage only
  ensureLocalDir();
  const localPath = path.join(LOCAL_ASSETS_DIR, fileName);
  fs.writeFileSync(localPath, input.buffer);

  await db.insert(schema.workspaceAssets).values({
    id,
    assetType: input.mimeType.startsWith("video/") ? "video" : "image",
    name: input.name,
    mimeType: input.mimeType,
    fileSize: input.buffer.length,
    storagePath: `assets/${fileName}`,
    source: input.source,
    prompt: input.prompt,
    processRunId: input.processRunId,
    contentHash,
  });

  return { id, filePath: localPath, contentHash };
}

// ============================================================
// Get asset
// ============================================================

/**
 * Get the file path (local) or public URL (Supabase) for an asset.
 */
export async function getAssetPath(assetId: string): Promise<string | null> {
  const { eq } = await import("drizzle-orm");
  const [asset] = await db
    .select({ storagePath: schema.workspaceAssets.storagePath })
    .from(schema.workspaceAssets)
    .where(eq(schema.workspaceAssets.id, assetId))
    .limit(1);

  if (!asset) return null;

  // If it's a URL, return as-is
  if (asset.storagePath.startsWith("http")) return asset.storagePath;

  // Otherwise it's a local relative path
  return path.resolve(process.cwd(), "data", asset.storagePath);
}

/**
 * Get the local file path for an asset (for X API upload which needs a buffer).
 * Downloads from Supabase if only stored remotely.
 */
export async function getAssetLocalPath(assetId: string): Promise<string | null> {
  const { eq } = await import("drizzle-orm");
  const [asset] = await db
    .select({
      storagePath: schema.workspaceAssets.storagePath,
      mimeType: schema.workspaceAssets.mimeType,
    })
    .from(schema.workspaceAssets)
    .where(eq(schema.workspaceAssets.id, assetId))
    .limit(1);

  if (!asset) return null;

  // Check if local copy exists
  const ext = mimeToExt(asset.mimeType);
  const localPath = path.join(LOCAL_ASSETS_DIR, `${assetId}${ext}`);
  if (fs.existsSync(localPath)) return localPath;

  // If stored in Supabase, the local copy was saved during upload
  // If it's missing (e.g., new deploy), download it
  if (asset.storagePath.startsWith("http")) {
    const supabase = getSupabase();
    if (!supabase) return null;

    // Extract the storage path from the public URL
    const urlPath = new URL(asset.storagePath).pathname;
    const bucketPath = urlPath.split(`/storage/v1/object/public/${BUCKET}/`)[1];
    if (!bucketPath) return null;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(bucketPath);

    if (error || !data) return null;

    ensureLocalDir();
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
    return localPath;
  }

  return path.resolve(process.cwd(), "data", asset.storagePath);
}

// ============================================================
// Helpers
// ============================================================

function ensureLocalDir(): void {
  if (!fs.existsSync(LOCAL_ASSETS_DIR)) {
    fs.mkdirSync(LOCAL_ASSETS_DIR, { recursive: true });
  }
}

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "application/pdf": ".pdf",
  };
  return map[mimeType] || ".bin";
}
