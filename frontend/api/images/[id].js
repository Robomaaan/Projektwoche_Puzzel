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

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return json(res, 405, { error: { message: 'Methode nicht erlaubt' } });
  try {
    const { admin, user } = await authedAdmin(req);
    const id = String(req.query.id || '').replace(/[^a-f0-9-]/gi, '');
    if (!id) return json(res, 400, { error: { message: 'Ungültige Bild-ID' } });
    const metaPath = `${user.id}/${id}.json`;
    const downloaded = await admin.storage.from(BUCKET).download(metaPath);
    if (downloaded.error) return json(res, 404, { error: { message: 'Bild nicht gefunden' } });
    const metadata = JSON.parse(await downloaded.data.text());
    if (metadata.ownerId !== user.id) return json(res, 403, { error: { message: 'Kein Zugriff auf dieses Bild' } });
    const paths = [metaPath, metadata.storagePath].filter(Boolean);
    const removed = await admin.storage.from(BUCKET).remove(paths);
    if (removed.error) throw removed.error;
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, error.status || 500, { error: { message: error.message || 'Bild konnte nicht gelöscht werden' } });
  }
}
