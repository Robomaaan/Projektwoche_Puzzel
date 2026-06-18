import { ASSET_BUCKET, apiError, authedAdmin, ensureAssetBucket, json } from '../_supabaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: { message: 'Methode nicht erlaubt' } });
  try {
    const { admin, user } = await authedAdmin(req);
    await ensureAssetBucket(admin);
    const listed = await admin.storage.from(ASSET_BUCKET).list(user.id, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (listed.error) throw listed.error;
    const metaFiles = (listed.data || []).filter((f) => f.name.endsWith('.json'));
    const images = [];
    for (const f of metaFiles) {
      const metaPath = `${user.id}/${f.name}`;
      const downloaded = await admin.storage.from(ASSET_BUCKET).download(metaPath);
      if (downloaded.error) continue;
      const metadata = JSON.parse(await downloaded.data.text());
      const signed = await admin.storage.from(ASSET_BUCKET).createSignedUrl(metadata.storagePath, 60 * 60 * 24 * 7);
      images.push({ ...metadata, url: signed.data?.signedUrl || '' });
    }
    images.sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
    return json(res, 200, { images });
  } catch (error) {
    return apiError(res, error, 'Bilder konnten nicht geladen werden');
  }
}
