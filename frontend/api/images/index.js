import { createClient } from '@supabase/supabase-js';

const BUCKET = 'puzzle-assets';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function env(name, fallback) {
  return process.env[name] || (fallback ? process.env[fallback] : '');
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
  if (!error) return true;
  const created = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] });
  if (created.error && !String(created.error.message).toLowerCase().includes('already')) throw created.error;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: { message: 'Methode nicht erlaubt' } });
  try {
    const { admin, user } = await authedAdmin(req);
    await ensureBucket(admin);
    const listed = await admin.storage.from(BUCKET).list(user.id, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (listed.error) throw listed.error;
    const metaFiles = (listed.data || []).filter((f) => f.name.endsWith('.json'));
    const images = [];
    for (const f of metaFiles) {
      const metaPath = `${user.id}/${f.name}`;
      const downloaded = await admin.storage.from(BUCKET).download(metaPath);
      if (downloaded.error) continue;
      const metadata = JSON.parse(await downloaded.data.text());
      const signed = await admin.storage.from(BUCKET).createSignedUrl(metadata.storagePath, 60 * 60 * 24 * 7);
      images.push({ ...metadata, url: signed.data?.signedUrl || '' });
    }
    images.sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
    return json(res, 200, { images });
  } catch (error) {
    return json(res, error.status || 500, { error: { message: error.message || 'Bilder konnten nicht geladen werden' } });
  }
}
