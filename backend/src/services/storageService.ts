import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { config } from '../config.js';

export const root = path.resolve(process.cwd());
export const uploadDir = path.join(root, 'storage', 'uploads');
export const generatedDir = path.join(root, 'storage', 'generated');
export const previewDir = path.join(root, 'storage', 'previews');
export const supabaseCacheDir = path.join(root, 'storage', 'supabase-cache');

export function isSupabaseStorageEnabled() {
  return Boolean(config.supabase.url && config.supabase.serviceRoleKey && config.supabase.storageBucket);
}

export async function ensureStorage() {
  await Promise.all([
    fs.mkdir(uploadDir, { recursive: true }),
    fs.mkdir(generatedDir, { recursive: true }),
    fs.mkdir(previewDir, { recursive: true }),
    fs.mkdir(supabaseCacheDir, { recursive: true }),
    fs.mkdir(path.join(root, 'data'), { recursive: true }),
  ]);
}

export function extensionFor(mime: string) {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '';
}

function encodeStorageKey(key: string) {
  return key.split('/').map(encodeURIComponent).join('/');
}

function supabaseObjectUrl(bucket: string, key: string) {
  return `${config.supabase.url}/storage/v1/object/${bucket}/${encodeStorageKey(key)}`;
}

function parseSupabasePath(storagePath: string) {
  if (!storagePath.startsWith('supabase://')) return null;
  const withoutScheme = storagePath.slice('supabase://'.length);
  const slash = withoutScheme.indexOf('/');
  if (slash < 1) return null;
  return { bucket: withoutScheme.slice(0, slash), key: withoutScheme.slice(slash + 1) };
}

async function assertSupabaseResponse(res: Response, action: string) {
  if (res.ok) return;
  const detail = await res.text().catch(() => '');
  throw Object.assign(new Error(`Supabase Storage ${action} fehlgeschlagen (${res.status})${detail ? `: ${detail}` : ''}`), { status: 502 });
}

export async function uploadSupabaseObject(key: string, body: Buffer, contentType: string) {
  if (!isSupabaseStorageEnabled()) return null;
  const bucket = config.supabase.storageBucket;
  const res = await fetch(supabaseObjectUrl(bucket, key), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
      apikey: config.supabase.serviceRoleKey,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: body as unknown as BodyInit,
  });
  await assertSupabaseResponse(res, 'Upload');
  return `supabase://${bucket}/${key}`;
}

export async function uploadLocalFileToSupabase(key: string, filePath: string, contentType: string) {
  const body = await fs.readFile(filePath);
  return uploadSupabaseObject(key, body, contentType);
}

export async function resolveReadableFile(storagePath: string) {
  const parsed = parseSupabasePath(storagePath);
  if (!parsed) return storagePath;
  await ensureStorage();
  const cachePath = path.join(supabaseCacheDir, parsed.key);
  try {
    await fs.access(cachePath);
    return cachePath;
  } catch {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
  }
  const res = await fetch(supabaseObjectUrl(parsed.bucket, parsed.key), {
    headers: { Authorization: `Bearer ${config.supabase.serviceRoleKey}`, apikey: config.supabase.serviceRoleKey },
  });
  await assertSupabaseResponse(res, 'Download');
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(cachePath, buffer);
  return cachePath;
}

export async function saveValidatedImage(file: Express.Multer.File) {
  if (!file) throw Object.assign(new Error('Keine Datei hochgeladen'), { status: 400 });
  if (file.size > config.uploadMaxMb * 1024 * 1024) throw Object.assign(new Error('Datei ist zu groß'), { status: 400 });
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) throw Object.assign(new Error('Nur JPG, PNG und WEBP sind erlaubt'), { status: 400 });
  const ext = extensionFor(file.mimetype);
  if (!ext) throw Object.assign(new Error('Ungültige Dateiendung'), { status: 400 });
  const metadata = await sharp(file.buffer).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 100 || metadata.height < 100) throw Object.assign(new Error('Bild muss mindestens 100x100 Pixel groß sein'), { status: 400 });
  await ensureStorage();
  const storedFileName = `${crypto.randomUUID()}${ext}`;
  const storagePath = path.join(uploadDir, storedFileName);
  await fs.writeFile(storagePath, file.buffer);
  const remotePath = await uploadSupabaseObject(`uploads/${storedFileName}`, file.buffer, file.mimetype);
  return { storedFileName, storagePath: remotePath ?? storagePath, localPath: storagePath, width: metadata.width, height: metadata.height };
}

export function publicFilePath(filePath: string) {
  const parsed = parseSupabasePath(filePath);
  if (parsed) return `${config.supabase.url}/storage/v1/object/public/${parsed.bucket}/${encodeStorageKey(parsed.key)}`;
  return `/files/${path.relative(path.join(root, 'storage'), filePath).replaceAll('\\', '/')}`;
}
