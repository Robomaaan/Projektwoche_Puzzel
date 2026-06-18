import formidable from 'formidable';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ASSET_BUCKET, IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, apiError, authedAdmin, ensureAssetBucket, json } from '../_supabaseAdmin.js';

export const config = { api: { bodyParser: false } };

const ALLOWED = new Set(IMAGE_MIME_TYPES);

function safeName(name) {
  const ext = path.extname(name || '').toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
  const base = path.basename(name || 'upload', ext).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'upload';
  return `${base}${ext}`;
}

async function parse(req) {
  const form = formidable({ multiples: false, maxFileSize: MAX_IMAGE_BYTES, keepExtensions: true });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => err ? reject(err) : resolve({ fields, files }));
  });
}

function single(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: { message: 'Methode nicht erlaubt' } });
  try {
    const { admin, user } = await authedAdmin(req);
    await ensureAssetBucket(admin);
    const { fields, files } = await parse(req);
    const file = single(files.image);
    if (!file) return json(res, 400, { error: { message: 'Kein Bild im Feld "image" gefunden.' } });
    const mime = file.mimetype || 'application/octet-stream';
    if (!ALLOWED.has(mime)) return json(res, 415, { error: { message: 'Nur JPG, PNG, WEBP oder GIF sind erlaubt.' } });
    if (file.size > MAX_IMAGE_BYTES) return json(res, 413, { error: { message: 'Bild ist größer als 10 MB.' } });

    const id = crypto.randomUUID();
    const originalFileName = file.originalFilename || 'upload';
    const objectName = `${Date.now()}-${id}-${safeName(originalFileName)}`;
    const storagePath = `${user.id}/${objectName}`;
    const metaPath = `${user.id}/${id}.json`;
    const buffer = await readFile(file.filepath);
    const uploaded = await admin.storage.from(ASSET_BUCKET).upload(storagePath, buffer, { contentType: mime, upsert: false });
    if (uploaded.error) throw uploaded.error;

    const metadata = {
      id,
      ownerId: user.id,
      originalFileName,
      storagePath,
      metaPath,
      width: Number(single(fields.width) || 0),
      height: Number(single(fields.height) || 0),
      size: file.size,
      mimeType: mime,
      status: 'uploaded',
      createdAt: new Date().toISOString(),
      persistence: 'supabase-storage',
    };
    const metaUpload = await admin.storage.from(ASSET_BUCKET).upload(metaPath, JSON.stringify(metadata, null, 2), { contentType: 'application/json', upsert: true });
    if (metaUpload.error) throw metaUpload.error;
    const signed = await admin.storage.from(ASSET_BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    return json(res, 201, { image: { ...metadata, url: signed.data?.signedUrl || '' } });
  } catch (error) {
    return apiError(res, error, 'Upload fehlgeschlagen');
  }
}
