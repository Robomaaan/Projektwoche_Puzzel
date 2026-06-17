import { ASSET_BUCKET, apiError, authedAdmin, json } from '../_supabaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return json(res, 405, { error: { message: 'Methode nicht erlaubt' } });
  try {
    const { admin, user } = await authedAdmin(req);
    const id = String(req.query.id || '').replace(/[^a-f0-9-]/gi, '');
    if (!id) return json(res, 400, { error: { message: 'Ungültige Bild-ID' } });
    const metaPath = `${user.id}/${id}.json`;
    const downloaded = await admin.storage.from(ASSET_BUCKET).download(metaPath);
    if (downloaded.error) return json(res, 404, { error: { message: 'Bild nicht gefunden' } });
    const metadata = JSON.parse(await downloaded.data.text());
    if (metadata.ownerId !== user.id) return json(res, 403, { error: { message: 'Kein Zugriff auf dieses Bild' } });
    const paths = [metaPath, metadata.storagePath].filter(Boolean);
    const removed = await admin.storage.from(ASSET_BUCKET).remove(paths);
    if (removed.error) throw removed.error;
    return json(res, 200, { ok: true });
  } catch (error) {
    return apiError(res, error, 'Bild konnte nicht gelöscht werden');
  }
}
