import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { prisma } from '../db/prisma.js';
import { generatedDir, previewDir, ensureStorage, resolveReadableFile, uploadLocalFileToSupabase } from './storageService.js';

export async function generatePuzzle(ownerId: string, input: { imageId:string; title:string; rows:number; columns:number; difficulty:string; pieceShape:string; visibility?: 'private' | 'public' }) {
  const image = await prisma.imageUpload.findFirst({ where: { id: input.imageId, ownerId } });
  if (!image) throw Object.assign(new Error('Bild nicht gefunden'), { status: 404 });
  const rows = Math.min(Math.max(Number(input.rows || 4), 2), 20);
  const columns = Math.min(Math.max(Number(input.columns || 4), 2), 20);
  await ensureStorage();
  const sourceImagePath = await resolveReadableFile(image.storagePath);
  const project = await prisma.puzzleProject.create({
    data: {
      ownerId,
      imageId: image.id,
      title: input.title || image.originalFileName,
      status: 'processing',
      visibility: input.visibility ?? 'private',
      configuration: { create: { rows, columns, difficulty: input.difficulty || 'medium', pieceShape: input.pieceShape || 'classic' } },
    },
  });
  const previewPath = path.join(previewDir, `${project.id}.webp`);
  await sharp(sourceImagePath).resize({ width: 900, height: 600, fit: 'cover' }).webp({ quality: 88 }).toFile(previewPath);
  const remotePreviewPath = await uploadLocalFileToSupabase(`previews/${project.id}.webp`, previewPath, 'image/webp');
  const resized = sharp(sourceImagePath).resize(900, 600, { fit: 'cover' });
  const pieceWidth = Math.floor(900 / columns), pieceHeight = Math.floor(600 / rows);
  const piecesData = [] as Array<{row:number;column:number;targetX:number;targetY:number;currentX:number;currentY:number;imagePath:string;isPlaced:boolean}>;
  const puzzleFolder = path.join(generatedDir, project.id);
  await fs.mkdir(puzzleFolder, { recursive: true });
  const startX = 930;
  const startY = 20;
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const piecePath = path.join(puzzleFolder, `piece_${r}_${c}.webp`);
    const width = c === columns - 1 ? 900 - c * pieceWidth : pieceWidth;
    const height = r === rows - 1 ? 600 - r * pieceHeight : pieceHeight;
    await resized.clone().extract({ left: c * pieceWidth, top: r * pieceHeight, width, height }).webp({ quality: 86 }).toFile(piecePath);
    const remotePiecePath = await uploadLocalFileToSupabase(`generated/${project.id}/piece_${r}_${c}.webp`, piecePath, 'image/webp');
    const idx = piecesData.length;
    piecesData.push({ row: r, column: c, targetX: c * pieceWidth, targetY: r * pieceHeight, currentX: startX + (idx % 3) * (pieceWidth * 0.55), currentY: startY + Math.floor(idx / 3) * (pieceHeight * 0.45), imagePath: remotePiecePath ?? piecePath, isPlaced: false });
  }
  await prisma.generatedPuzzle.create({ data: { projectId: project.id, previewPath: remotePreviewPath ?? previewPath, status: 'generated', pieces: { create: piecesData } }, include: { pieces: true } });
  await prisma.puzzleProject.update({ where: { id: project.id }, data: { status: 'generated' } });
  await prisma.savedPuzzleState.create({ data: { projectId: project.id, ownerId, progressPercent: 0, snapshotJson: JSON.stringify({ pieces: {}, zoom: 1, timerSeconds: 0, selectedPieceId: null }) } });
  return prisma.puzzleProject.findUnique({ where: { id: project.id }, include: { image: true, configuration: true, generated: { include: { pieces: true } }, savedStates: { where: { ownerId }, take: 1 } } });
}
