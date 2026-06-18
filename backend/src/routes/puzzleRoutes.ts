import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { generatePuzzle } from '../services/puzzleGeneratorService.js';
import { publicFilePath } from '../services/storageService.js';

const router = Router();
router.use(requireAuth);

const mutableProjectSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  visibility: z.enum(['private', 'public']).optional(),
}).refine((value) => value.title !== undefined || value.visibility !== undefined, { message: 'Keine Änderungen übergeben' });

const includeForUser = (userId: string) => ({
  image: true,
  configuration: true,
  generated: { include: { pieces: true } },
  savedStates: { where: { ownerId: userId }, take: 1 },
}) as const;

function canReadWhere(id: string, userId: string) {
  return { id, OR: [{ ownerId: userId }, { visibility: 'public' }] };
}

function serialize(p: any) {
  if (!p) return p;
  const savedState = p.savedStates?.[0] ?? undefined;
  return {
    ...p,
    savedState,
    savedStates: undefined,
    image: p.image ? { ...p.image, url: publicFilePath(p.image.storagePath) } : undefined,
    generated: p.generated
      ? {
          ...p.generated,
          previewUrl: publicFilePath(p.generated.previewPath),
          pieces: p.generated.pieces?.map((x: any) => ({ ...x, url: publicFilePath(x.imagePath) })),
        }
      : undefined,
  };
}

router.post('/generate', async (req, res, next) => {
  try {
    const input = z
      .object({
        imageId: z.string(),
        title: z.string().min(1).optional(),
        rows: z.number().int().min(2).max(20).default(4),
        columns: z.number().int().min(2).max(20).default(4),
        difficulty: z.string().default('medium'),
        pieceShape: z.string().default('classic'),
        visibility: z.enum(['private', 'public']).default('private'),
      })
      .parse(req.body);
    const project = await generatePuzzle(req.user!.id, { ...input, title: input.title ?? 'Neues Puzzle' });
    res.status(201).json({ project: serialize(project) });
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const projects = await prisma.puzzleProject.findMany({
      where: { OR: [{ ownerId: req.user!.id }, { visibility: 'public' }] },
      orderBy: { updatedAt: 'desc' },
      include: includeForUser(req.user!.id),
    });
    res.json({ projects: projects.map(serialize) });
  } catch (e) {
    next(e);
  }
});

router.get('/recent', async (req, res, next) => {
  try {
    const projects = await prisma.puzzleProject.findMany({
      where: { ownerId: req.user!.id },
      orderBy: [{ lastOpenedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 4,
      include: includeForUser(req.user!.id),
    });
    res.json({ projects: projects.map(serialize) });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const p = await prisma.puzzleProject.findFirst({ where: canReadWhere(req.params.id, req.user!.id), include: includeForUser(req.user!.id) });
    if (!p) throw Object.assign(new Error('Puzzle nicht gefunden'), { status: 404 });
    await prisma.puzzleProject.update({ where: { id: p.id }, data: { lastOpenedAt: new Date() } });
    res.json({ project: serialize(p) });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/status', async (req, res, next) => {
  try {
    const p = await prisma.puzzleProject.findFirst({ where: canReadWhere(req.params.id, req.user!.id), select: { id: true, status: true, visibility: true } });
    if (!p) throw Object.assign(new Error('Puzzle nicht gefunden'), { status: 404 });
    res.json(p);
  } catch (e) {
    next(e);
  }
});

router.get('/:id/download', async (req, res, next) => {
  try {
    const p = await prisma.puzzleProject.findFirst({ where: canReadWhere(req.params.id, req.user!.id), include: { generated: true } });
    if (!p?.generated) throw Object.assign(new Error('Puzzle nicht gefunden'), { status: 404 });
    res.download(p.generated.previewPath);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const p = await prisma.puzzleProject.findFirst({ where: { id: req.params.id, ownerId: req.user!.id } });
    if (!p) throw Object.assign(new Error('Puzzle nicht gefunden'), { status: 404 });
    await prisma.puzzleProject.delete({ where: { id: p.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const body = mutableProjectSchema.parse(req.body);
    const p = await prisma.puzzleProject.findFirst({ where: { id: req.params.id, ownerId: req.user!.id } });
    if (!p) throw Object.assign(new Error('Puzzle nicht gefunden'), { status: 404 });
    const updated = await prisma.puzzleProject.update({
      where: { id: p.id },
      data: body,
      include: includeForUser(req.user!.id),
    });
    res.json({ project: serialize(updated) });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/progress', async (req, res, next) => {
  try {
    const p = await prisma.puzzleProject.findFirst({ where: canReadWhere(req.params.id, req.user!.id) });
    if (!p) throw Object.assign(new Error('Puzzle nicht gefunden'), { status: 404 });
    const progress = await prisma.savedPuzzleState.findUnique({ where: { projectId_ownerId: { projectId: p.id, ownerId: req.user!.id } } });
    res.json({ progress: progress ? { ...progress, snapshot: JSON.parse(progress.snapshotJson) } : null });
  } catch (e) {
    next(e);
  }
});

async function saveProgress(req: any, res: any, next: any) {
  try {
    const body = z.object({ snapshot: z.any(), progressPercent: z.number().min(0).max(100) }).parse(req.body);
    const p = await prisma.puzzleProject.findFirst({ where: canReadWhere(req.params.id, req.user.id) });
    if (!p) throw Object.assign(new Error('Puzzle nicht gefunden'), { status: 404 });
    const progress = await prisma.savedPuzzleState.upsert({
      where: { projectId_ownerId: { projectId: p.id, ownerId: req.user.id } },
      update: { snapshotJson: JSON.stringify(body.snapshot), progressPercent: body.progressPercent },
      create: { projectId: p.id, ownerId: req.user.id, snapshotJson: JSON.stringify(body.snapshot), progressPercent: body.progressPercent },
    });
    res.json({ progress: { ...progress, snapshot: JSON.parse(progress.snapshotJson) } });
  } catch (e) {
    next(e);
  }
}
router.put('/:id/progress', saveProgress);
router.post('/:id/progress/autosave', saveProgress);
export default router;
