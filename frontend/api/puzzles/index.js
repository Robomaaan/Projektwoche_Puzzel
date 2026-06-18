import { apiError, authedAdmin, ensureAssetBucket, json } from '../_supabaseAdmin.js';
import { listVisibleProjects, serializeProject } from './_puzzleStore.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: { message: 'Methode nicht erlaubt' } });
  try {
    const { admin, user } = await authedAdmin(req);
    await ensureAssetBucket(admin);
    const projects = await listVisibleProjects(admin, user.id);
    const serialized = await Promise.all(projects.map((project) => serializeProject(admin, project, user.id)));
    return json(res, 200, { projects: serialized });
  } catch (error) {
    return apiError(res, error, 'Puzzles konnten nicht geladen werden');
  }
}
