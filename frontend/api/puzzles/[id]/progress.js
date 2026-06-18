import { apiError, authedAdmin, ensureAssetBucket, json } from '../../_supabaseAdmin.js';
import { findVisibleProject, nowIso, progressPath, readJson, writeJson } from '../_puzzleStore.js';

async function save(req, res, admin, user, project) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const progress = {
    id: `${user.id}:${project.id}`,
    projectId: project.id,
    ownerId: user.id,
    snapshotJson: JSON.stringify(body.snapshot || {}),
    progressPercent: Math.max(0, Math.min(100, Number(body.progressPercent || 0))),
    updatedAt: nowIso(),
  };
  await writeJson(admin, progressPath(user.id, project.id), progress);
  return json(res, 200, { progress: { ...progress, snapshot: body.snapshot || {} } });
}

export default async function handler(req, res) {
  try {
    const { admin, user } = await authedAdmin(req);
    await ensureAssetBucket(admin);
    const project = await findVisibleProject(admin, user.id, req.query.id);
    if (!project) return json(res, 404, { error: { message: 'Puzzle nicht gefunden' } });
    if (req.method === 'GET') {
      const progress = await readJson(admin, progressPath(user.id, project.id));
      return json(res, 200, { progress: progress ? { ...progress, snapshot: JSON.parse(progress.snapshotJson || '{}') } : null });
    }
    if (req.method === 'PUT' || req.method === 'POST') return save(req, res, admin, user, project);
    return json(res, 405, { error: { message: 'Methode nicht erlaubt' } });
  } catch (error) {
    return apiError(res, error, 'Fortschritt konnte nicht gespeichert werden');
  }
}
