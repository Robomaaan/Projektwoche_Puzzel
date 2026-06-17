import { createClient } from '@supabase/supabase-js';

export const ASSET_BUCKET = process.env.SUPABASE_ASSET_BUCKET || 'puzzle-assets';
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const SIDECAR_MIME_TYPES = ['application/json'];
export const MAX_IMAGE_BYTES = Number(process.env.UPLOAD_MAX_BYTES || 10 * 1024 * 1024);

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function env(name, fallback) {
  return process.env[name] || (fallback ? process.env[fallback] : '');
}

export function serverConfigStatus() {
  return {
    supabaseUrl: Boolean(env('SUPABASE_URL', 'VITE_SUPABASE_URL')),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    assetBucket: ASSET_BUCKET,
    maxImageBytes: MAX_IMAGE_BYTES,
  };
}

export function createAdminClient() {
  const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw Object.assign(new Error('Supabase ist serverseitig nicht konfiguriert.'), { status: 500 });
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authedAdmin(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw Object.assign(new Error('Nicht angemeldet: Supabase-Session fehlt.'), { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Session ungültig oder abgelaufen.'), { status: 401 });
  return { admin, user: data.user };
}

export async function ensureAssetBucket(admin) {
  const allowedMimeTypes = [...IMAGE_MIME_TYPES, ...SIDECAR_MIME_TYPES];
  const { error } = await admin.storage.getBucket(ASSET_BUCKET);
  if (!error) {
    await admin.storage.updateBucket(ASSET_BUCKET, { public: false, fileSizeLimit: MAX_IMAGE_BYTES, allowedMimeTypes });
    return true;
  }
  const created = await admin.storage.createBucket(ASSET_BUCKET, { public: false, fileSizeLimit: MAX_IMAGE_BYTES, allowedMimeTypes });
  if (created.error && !String(created.error.message).toLowerCase().includes('already')) throw created.error;
  return true;
}

export function apiError(res, error, fallback) {
  return json(res, error.status || 500, { error: { message: error.message || fallback } });
}
