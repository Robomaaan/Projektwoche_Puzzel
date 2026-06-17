import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const config = { api: { bodyParser: false } };

const BUCKET = 'puzzle-assets';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const BUCKET_MIME_TYPES = [...ALLOWED, 'application/json'];

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function env(name, fallback) {
  return process.env[name] || (fallback ? process.env[fallback] : '');
}

function safeName(name) {
  const ext = path.extname(name || '').toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
  const base = path.basename(name || 'upload', ext).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'upload';
  return `${base}${ext}`;
}

async function parse(req) {
  const form = formidable({ multiples: false, maxFileSize: MAX_BYTES, keepExtensions: true });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => err ? reject(err) : resolve({ fields, files }));
  });
}

async function authedAdmin(req) {
  const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw Object.assign(new Error('Supabase ist serverseitig nicht konfiguriert.'), { status: 500 });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw Object.assign(new Error('Nicht angemeldet: Supabase-Session fehlt.'), { status: 401 });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Session ungültig oder abgelaufen.'), { status: 401 });
  return { admin, user: data.user };
}

async function ensureBucket(admin) {
  const { error } = await admin.storage.getBucket(BUCKET);
  if (!error) {
    await admin.storage.updateBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: BUCKET_MIME_TYPES });
    return;
  }
  const created = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: BUCKET_MIME_TYPES });
  if (created.error && !String(created.error.message).toLowerCase().includes('already')) throw created.error;
}

function single(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: { message: 'Methode nicht erlaubt' } });
  try {
    const { admin, user } = await authedAdmin(req);
    await ensureBucket(admin);
    const { fields, files } = await parse(req);
    const file = single(files.image);
    if (!file) return json(res, 400, { error: { message: 'Kein Bild im Feld "image" gefunden.' } });
    const mime = file.mimetype || 'application/octet-stream';
    if (!ALLOWED.has(mime)) return json(res, 415, { error: { message: 'Nur JPG, PNG, WEBP oder GIF sind erlaubt.' } });
    if (file.size > MAX_BYTES) return json(res, 413, { error: { message: 'Bild ist größer als 10 MB.' } });

    const id = crypto.randomUUID();
    const originalFileName = file.originalFilename || 'upload';
    const objectName = `${Date.now()}-${id}-${safeName(originalFileName)}`;
    const storagePath = `${user.id}/${objectName}`;
    const metaPath = `${user.id}/${id}.json`;
    const buffer = await readFile(file.filepath);
    const uploaded = await admin.storage.from(BUCKET).upload(storagePath, buffer, { contentType: mime, upsert: false });
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
    const metaUpload = await admin.storage.from(BUCKET).upload(metaPath, JSON.stringify(metadata, null, 2), { contentType: 'application/json', upsert: true });
    if (metaUpload.error) throw metaUpload.error;
    const signed = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    return json(res, 201, { image: { ...metadata, url: signed.data?.signedUrl || '' } });
  } catch (error) {
    return json(res, error.status || 500, { error: { message: error.message || 'Upload fehlgeschlagen' } });
  }
}
