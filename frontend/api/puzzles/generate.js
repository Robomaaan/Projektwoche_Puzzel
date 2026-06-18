import { apiError, authedAdmin, ensureAssetBucket, json } from '../_supabaseAdmin.js';
import { createProject, projectPath, readImage, serializeProject, writeJson } from './_puzzleStore.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: { message: 'Methode nicht erlaubt' } });
  try {
    const { admin, user } = await authedAdmin(req);
    await ensureAssetBucket(admin);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.imageId) return json(res, 400, { error: { message: 'Bitte zuerst ein Bild auswählen.' } });
    const image = await readImage(admin, user.id, body.imageId);
    if (!image) return json(res, 404, { error: { message: 'Bild nicht gefunden.' } });
    const rows = Number(body.rows || 4);
    const columns = Number(body.columns || 4);
    if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 2 || columns < 2 || rows > 20 || columns > 20) {
      return json(res, 400, { error: { message: 'Zeilen und Spalten müssen zwischen 2 und 20 liegen.' } });
    }
    const project = createProject(user.id, image, { ...body, rows, columns });
    await writeJson(admin, projectPath(user.id, project.id), project);
    return json(res, 201, { project: await serializeProject(admin, project, user.id) });
  } catch (error) {
    return apiError(res, error, 'Puzzle konnte nicht generiert werden');
  }
}
