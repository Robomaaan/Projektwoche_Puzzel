import crypto from 'node:crypto';
import { ASSET_BUCKET } from '../_supabaseAdmin.js';

const PUZZLE_DIR = 'puzzles';
const PROGRESS_DIR = 'progress';

export function nowIso() { return new Date().toISOString(); }

export function signedUrl(admin, storagePath, ttl = 60 * 60 * 24 * 7) {
  return admin.storage.from(ASSET_BUCKET).createSignedUrl(storagePath, ttl).then(({ data }) => data?.signedUrl || '');
}

export async function readJson(admin, path) {
  const downloaded = await admin.storage.from(ASSET_BUCKET).download(path);
  if (downloaded.error) return null;
  return JSON.parse(await downloaded.data.text());
}

export async function writeJson(admin, path, value) {
  const uploaded = await admin.storage.from(ASSET_BUCKET).upload(path, JSON.stringify(value, null, 2), {
    contentType: 'application/json',
    upsert: true,
  });
  if (uploaded.error) throw uploaded.error;
}

export async function deleteObject(admin, path) {
  const removed = await admin.storage.from(ASSET_BUCKET).remove([path]);
  if (removed.error) throw removed.error;
}

export async function readImage(admin, ownerId, imageId) {
  const image = await readJson(admin, `${ownerId}/${imageId}.json`);
  if (!image) return null;
  return { ...image, url: await signedUrl(admin, image.storagePath) };
}

export function projectPath(ownerId, projectId) {
  return `${ownerId}/${PUZZLE_DIR}/${projectId}.json`;
}

export function progressPath(ownerId, projectId) {
  return `${ownerId}/${PROGRESS_DIR}/${projectId}.json`;
}

function createPieces(rows, columns) {
  const pieceW = 900 / columns;
  const pieceH = 600 / rows;
  const pieces = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      pieces.push({
        id: crypto.randomUUID(),
        row,
        column,
        targetX: column * pieceW,
        targetY: row * pieceH,
        currentX: 940 + column * 24,
        currentY: 40 + row * 24,
        imagePath: '',
        isPlaced: false,
      });
    }
  }
  return pieces;
}

export function createProject(userId, image, input) {
  const id = crypto.randomUUID();
  const rows = Number(input.rows || 4);
  const columns = Number(input.columns || 4);
  const createdAt = nowIso();
  return {
    id,
    ownerId: userId,
    imageId: image.id,
    title: String(input.title || 'Neues Puzzle').slice(0, 120),
    status: 'generated',
    visibility: input.visibility === 'public' ? 'public' : 'private',
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: null,
    image: { ...image, url: undefined },
    configuration: {
      rows,
      columns,
      difficulty: String(input.difficulty || 'medium'),
      pieceShape: String(input.pieceShape || 'classic'),
      outputFormat: 'web',
    },
    generated: {
      id: crypto.randomUUID(),
      projectId: id,
      previewPath: image.storagePath,
      generatedAt: createdAt,
      status: 'generated',
      pieces: createPieces(rows, columns).map((piece) => ({ ...piece, imagePath: image.storagePath })),
    },
  };
}

export async function serializeProject(admin, project, viewerId) {
  const previewUrl = project.generated?.previewPath ? await signedUrl(admin, project.generated.previewPath) : '';
  const image = project.image?.storagePath ? { ...project.image, url: await signedUrl(admin, project.image.storagePath) } : project.image;
  const savedState = await readJson(admin, progressPath(viewerId, project.id));
  return {
    ...project,
    image,
    generated: project.generated ? {
      ...project.generated,
      previewUrl,
      pieces: (project.generated.pieces || []).map((piece) => ({ ...piece, url: previewUrl })),
    } : undefined,
    savedState: savedState || undefined,
  };
}

export async function listUserProjects(admin, ownerId) {
  const listed = await admin.storage.from(ASSET_BUCKET).list(`${ownerId}/${PUZZLE_DIR}`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
  if (listed.error) return [];
  const projects = [];
  for (const f of listed.data || []) {
    if (!f.name.endsWith('.json')) continue;
    const project = await readJson(admin, `${ownerId}/${PUZZLE_DIR}/${f.name}`);
    if (project) projects.push(project);
  }
  return projects;
}

export async function listVisibleProjects(admin, viewerId) {
  const root = await admin.storage.from(ASSET_BUCKET).list('', { limit: 100 });
  if (root.error) throw root.error;
  const all = [];
  const prefixes = new Set([viewerId, ...(root.data || []).map((entry) => entry.name).filter(Boolean)]);
  for (const ownerId of prefixes) {
    const projects = await listUserProjects(admin, ownerId);
    all.push(...projects.filter((p) => p.ownerId === viewerId || p.visibility === 'public'));
  }
  all.sort((a, b) => Date.parse(b.updatedAt || b.createdAt || '') - Date.parse(a.updatedAt || a.createdAt || ''));
  return all;
}

export async function findVisibleProject(admin, viewerId, projectId) {
  const visible = await listVisibleProjects(admin, viewerId);
  return visible.find((p) => p.id === projectId) || null;
}
