import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { config } from './config.js';
import { attachUser } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import puzzleRoutes from './routes/puzzleRoutes.js';
import { ensureStorage, root } from './services/storageService.js';

export function createApp(){
  const app=express();
  app.use(cors({ origin:(origin,cb)=>{ if(!origin || config.allowedOrigins.includes(origin)) return cb(null,true); cb(new Error('CORS nicht erlaubt')); }, credentials:true }));
  app.use(express.json({limit:'1mb'})); app.use(cookieParser()); app.use(attachUser);
  app.get('/health', (_req,res)=>res.json({ ok:true, service:'PuzzleStudio API', time:new Date().toISOString() }));
  app.use('/files', express.static(path.join(root,'storage')));
  app.use('/api/auth', authRoutes); app.use('/api', authRoutes); app.use('/api/images', imageRoutes); app.use('/api/puzzles', puzzleRoutes);
  app.use(notFound); app.use(errorHandler); return app;
}
export async function prepare(){ await ensureStorage(); }
