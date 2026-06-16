import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { config } from '../config.js';

export const root = path.resolve(process.cwd());
export const uploadDir = path.join(root, 'storage', 'uploads');
export const generatedDir = path.join(root, 'storage', 'generated');
export const previewDir = path.join(root, 'storage', 'previews');
export async function ensureStorage() { await Promise.all([fs.mkdir(uploadDir,{recursive:true}), fs.mkdir(generatedDir,{recursive:true}), fs.mkdir(previewDir,{recursive:true}), fs.mkdir(path.join(root,'data'),{recursive:true})]); }
export function extensionFor(mime: string) { if (mime === 'image/jpeg') return '.jpg'; if (mime === 'image/png') return '.png'; if (mime === 'image/webp') return '.webp'; return ''; }
export async function saveValidatedImage(file: Express.Multer.File) {
  if (!file) throw Object.assign(new Error('Keine Datei hochgeladen'), { status: 400 });
  if (file.size > config.uploadMaxMb * 1024 * 1024) throw Object.assign(new Error('Datei ist zu groß'), { status: 400 });
  const allowed = ['image/jpeg','image/png','image/webp'];
  if (!allowed.includes(file.mimetype)) throw Object.assign(new Error('Nur JPG, PNG und WEBP sind erlaubt'), { status: 400 });
  const ext = extensionFor(file.mimetype);
  if (!ext) throw Object.assign(new Error('Ungültige Dateiendung'), { status: 400 });
  const metadata = await sharp(file.buffer).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 100 || metadata.height < 100) throw Object.assign(new Error('Bild muss mindestens 100x100 Pixel groß sein'), { status: 400 });
  await ensureStorage();
  const storedFileName = `${crypto.randomUUID()}${ext}`;
  const storagePath = path.join(uploadDir, storedFileName);
  await fs.writeFile(storagePath, file.buffer);
  return { storedFileName, storagePath, width: metadata.width, height: metadata.height };
}
export function publicFilePath(filePath: string) { return `/files/${path.relative(path.join(root, 'storage'), filePath).replaceAll('\\','/')}`; }
