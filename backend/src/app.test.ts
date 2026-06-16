import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import sharp from 'sharp';
import { createApp, prepare } from './app.js';
import { prisma } from './db/prisma.js';

const app = createApp();
async function clean(){ await prisma.savedPuzzleState.deleteMany(); await prisma.puzzlePiece.deleteMany(); await prisma.generatedPuzzle.deleteMany(); await prisma.puzzleConfiguration.deleteMany(); await prisma.puzzleProject.deleteMany(); await prisma.imageUpload.deleteMany(); await prisma.authSession.deleteMany(); await prisma.userAccount.deleteMany(); }
async function signup(email:string){ const agent=request.agent(app); const res=await agent.post('/api/auth/register').send({email,password:'Passwort123!',displayName:'User '+email.split('@')[0]}); assert.equal(res.status,201); return agent; }

test('healthcheck returns ok', async()=>{ await prepare(); const res=await request(app).get('/health'); assert.equal(res.status,200); assert.equal(res.body.ok,true); });

test('register validation returns clear 400 instead of server error', async()=>{ await clean(); const res=await request(app).post('/api/auth/register').send({email:'keine-mail',password:'kurz',displayName:'A'}); assert.equal(res.status,400); assert.equal(res.body.error.message,'Ungültige Eingaben'); assert.ok(Array.isArray(res.body.error.issues)); });

test('register login me logout flow uses httpOnly session', async()=>{ await clean(); const agent=await signup('a@example.de'); const me=await agent.get('/api/auth/me'); assert.equal(me.status,200); assert.equal(me.body.user.email,'a@example.de'); const out=await agent.post('/api/auth/logout'); assert.equal(out.status,200); const after=await agent.get('/api/auth/me'); assert.equal(after.status,401); const login=await agent.post('/api/auth/login').send({email:'a@example.de',password:'Passwort123!'}); assert.equal(login.status,200); });

test('upload generate progress and ownership isolation', async()=>{ await clean(); const a=await signup('owner@example.de'); const b=await signup('other@example.de'); const img=await sharp({create:{width:320,height:240,channels:3,background:'#7c3aed'}}).png().toBuffer(); const up=await a.post('/api/images/upload').attach('image',img,{filename:'bergsee.png',contentType:'image/png'}); assert.equal(up.status,201); const imageId=up.body.image.id; const gen=await a.post('/api/puzzles/generate').send({imageId,title:'Bergsee',rows:3,columns:4,difficulty:'medium',pieceShape:'classic'}); assert.equal(gen.status,201); assert.equal(gen.body.project.generated.pieces.length,12); const projectId=gen.body.project.id; const denied=await b.get(`/api/puzzles/${projectId}`); assert.equal(denied.status,404); const save=await a.put(`/api/puzzles/${projectId}/progress`).send({snapshot:{placed:['x'],zoom:1.1,timerSeconds:12},progressPercent:25}); assert.equal(save.status,200); const load=await a.get(`/api/puzzles/${projectId}/progress`); assert.equal(load.status,200); assert.equal(load.body.progress.progressPercent,25); });
