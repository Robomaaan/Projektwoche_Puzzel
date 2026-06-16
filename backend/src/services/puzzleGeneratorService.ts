import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { prisma } from '../db/prisma.js';
import { generatedDir, previewDir, ensureStorage } from './storageService.js';

export async function generatePuzzle(ownerId: string, input: { imageId:string; title:string; rows:number; columns:number; difficulty:string; pieceShape:string }) {
  const image = await prisma.imageUpload.findFirst({ where: { id: input.imageId, ownerId } });
  if (!image) throw Object.assign(new Error('Bild nicht gefunden'), { status: 404 });
  const rows = Math.min(Math.max(Number(input.rows || 4), 2), 20);
  const columns = Math.min(Math.max(Number(input.columns || 4), 2), 20);
  await ensureStorage();
  const project = await prisma.puzzleProject.create({ data: { ownerId, imageId: image.id, title: input.title || image.originalFileName, status: 'processing', configuration: { create: { rows, columns, difficulty: input.difficulty || 'medium', pieceShape: input.pieceShape || 'classic' } } } });
  const previewPath = path.join(previewDir, `${project.id}.webp`);
  await sharp(image.storagePath).resize({ width: 900, height: 650, fit: 'inside' }).webp({ quality: 84 }).toFile(previewPath);
  const resized = sharp(image.storagePath).resize(900, 600, { fit: 'cover' });
  const pieceWidth = Math.floor(900 / columns), pieceHeight = Math.floor(600 / rows);
  const piecesData = [] as Array<{row:number;column:number;targetX:number;targetY:number;currentX:number;currentY:number;imagePath:string;isPlaced:boolean}>;
  const puzzleFolder = path.join(generatedDir, project.id); await fs.mkdir(puzzleFolder,{recursive:true});
  for (let r=0;r<rows;r++) for (let c=0;c<columns;c++) {
    const piecePath = path.join(puzzleFolder, `piece_${r}_${c}.webp`);
    await resized.clone().extract({ left:c*pieceWidth, top:r*pieceHeight, width: c===columns-1 ? 900-c*pieceWidth : pieceWidth, height: r===rows-1 ? 600-r*pieceHeight : pieceHeight }).webp({ quality:80 }).toFile(piecePath);
    piecesData.push({ row:r, column:c, targetX:c*pieceWidth, targetY:r*pieceHeight, currentX:40+(piecesData.length%8)*82, currentY:620+Math.floor(piecesData.length/8)*36, imagePath:piecePath, isPlaced:false });
  }
  const generated = await prisma.generatedPuzzle.create({ data: { projectId: project.id, previewPath, status: 'generated', pieces: { create: piecesData } }, include: { pieces: true } });
  await prisma.puzzleProject.update({ where:{id:project.id}, data:{ status:'generated' } });
  await prisma.savedPuzzleState.create({ data: { projectId: project.id, ownerId, progressPercent: 0, snapshotJson: JSON.stringify({ placed: [], zoom: 1, timerSeconds: 0 }) } });
  return prisma.puzzleProject.findUnique({ where:{ id: project.id }, include: { image:true, configuration:true, generated: { include: { pieces:true } }, savedState:true } });
}
