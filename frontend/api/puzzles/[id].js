import { apiError, authedAdmin, ensureAssetBucket, json } from '../_supabaseAdmin.js';
import { deleteObject, findVisibleProject, nowIso, projectPath, serializeProject, writeJson } from './_puzzleStore.js';

export default async function handler(req, res) {
  try {
    const { admin, user } = await authedAdmin(req);
    await ensureAssetBucket(admin);
    const id = req.query.id;
    const project = await findVisibleProject(admin, user.id, id);
    if (!project) return json(res, 404, { error: { message: 'Puzzle nicht gefunden' } });

    if (req.method === 'GET') {
      project.lastOpenedAt = nowIso();
      if (project.ownerId === user.id) await writeJson(admin, projectPath(project.ownerId, project.id), project);
      return json(res, 200, { project: await serializeProject(admin, project, user.id) });
    }

    if (req.method === 'PATCH') {
      if (project.ownerId !== user.id) return json(res, 403, { error: { message: 'Nur Eigentümer dürfen dieses Puzzle ändern.' } });
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (body.title !== undefined) project.title = String(body.title || project.title).slice(0, 120);
      if (body.visibility !== undefined) project.visibility = body.visibility === 'public' ? 'public' : 'private';
      project.updatedAt = nowIso();
      await writeJson(admin, projectPath(project.ownerId, project.id), project);
      return json(res, 200, { project: await serializeProject(admin, project, user.id) });
    }

    if (req.method === 'DELETE') {
      if (project.ownerId !== user.id) return json(res, 403, { error: { message: 'Nur Eigentümer dürfen dieses Puzzle löschen.' } });
      await deleteObject(admin, projectPath(project.ownerId, project.id));
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: { message: 'Methode nicht erlaubt' } });
  } catch (error) {
    return apiError(res, error, 'Puzzle-Anfrage fehlgeschlagen');
  }
}
