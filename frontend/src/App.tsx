import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Grid2X2, LayoutDashboard, LogOut, Puzzle, Settings, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import './styles.css';

type UserT = { id: string; email: string; displayName: string; language: string; timezone: string };
type ImageT = { id: string; ownerId: string; originalFileName: string; url: string; width: number; height: number; createdAt: string; status: string };
type Piece = { id: string; row: number; column: number; targetX: number; targetY: number; currentX: number; currentY: number; url: string; isPlaced: boolean };
type Project = { id: string; ownerId: string; title: string; status: string; visibility: 'private' | 'public'; updatedAt: string; image?: ImageT; configuration?: { rows: number; columns: number; difficulty: string }; generated?: { previewUrl: string; pieces: Piece[] }; savedState?: { progressPercent: number; snapshotJson: string } };
type PieceState = { x: number; y: number; rotation: number; placed: boolean };

const API = import.meta.env.VITE_API_URL || (location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://localhost:8000/api' : '/api');
async function api(path: string, options: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetch(API + path, { credentials: 'include', headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }, ...options });
  } catch {
    throw new Error('Backend nicht erreichbar. Bitte API-URL/VITE_API_URL prüfen.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok && API === '/api' && res.status === 404) throw new Error('Backend auf Vercel nicht verbunden. Bitte VITE_API_URL auf eine öffentliche Backend-URL setzen.');
  if (!res.ok) throw new Error(data.error?.message || 'API Fehler');
  return data;
}
function parseSnapshot(project: Project) {
  try { return project.savedState?.snapshotJson ? JSON.parse(project.savedState.snapshotJson) : {}; } catch { return {}; }
}

export function App() {
  const [user, setUser] = useState<UserT | null>(null);
  const [page, setPage] = useState(location.hash.replace('#', '') || 'dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [images, setImages] = useState<ImageT[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  useEffect(() => { api('/auth/me').then(d => setUser(d.user)).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (user) { if (page === 'login' || page === 'register') { setPage('dashboard'); location.hash = 'dashboard'; } void refresh(); } }, [user]);
  async function refresh() { const [imgs, projs] = await Promise.all([api('/images').catch(() => ({ images: [] })), api('/puzzles').catch(() => ({ projects: [] }))]); setImages(imgs.images); setProjects(projs.projects); }
  function nav(p: string) { setPage(p); location.hash = p; setError(''); }
  async function logout() { await api('/auth/logout', { method: 'POST' }); setUser(null); setPage('login'); }

  if (loading) return <div className="center">Lade PuzzleStudio…</div>;
  if (!user) return <AuthPage mode={page === 'register' ? 'register' : 'login'} setMode={setPage} onUser={setUser} />;
  const currentPage = ['dashboard', 'images', 'puzzles', 'play', 'account'].includes(page) ? page : 'dashboard';
  const ctx = { user, images, projects, refresh, nav, setError, setActiveProject };
  return <div className="app"><aside className="sidebar"><div className="brand"><span className="logo">✣</span><b>PuzzleStudio</b></div><nav><Nav icon={<LayoutDashboard />} label="Dashboard" page="dashboard" cur={currentPage} nav={nav} /><Nav icon={<Camera />} label="Bildverwaltung" page="images" cur={currentPage} nav={nav} /><Nav icon={<Puzzle />} label="Puzzles" page="puzzles" cur={currentPage} nav={nav} /><Nav icon={<Settings />} label="Accountverwaltung" page="account" cur={currentPage} nav={nav} /></nav><div className="profile"><div className="avatar">{user.displayName[0]?.toUpperCase()}</div><div><b>{user.displayName}</b><small>{user.email}</small></div><button title="Logout" onClick={logout}><LogOut size={16} /></button></div></aside><main className="main"><section className="card">{error && <div className="error">{error}</div>}{currentPage === 'dashboard' && <Dashboard {...ctx} />}{currentPage === 'images' && <Images {...ctx} />}{currentPage === 'puzzles' && <Puzzles {...ctx} />}{currentPage === 'play' && activeProject && <Play project={activeProject} refresh={refresh} nav={nav} setError={setError} />}{currentPage === 'account' && <Account user={user} setUser={setUser} logout={logout} setError={setError} />}</section></main></div>;
}
function Nav(p: { icon: React.ReactNode; label: string; page: string; cur: string; nav: (x: string) => void }) { return <button className={p.cur === p.page ? 'active' : ''} onClick={() => p.nav(p.page)}>{p.icon}<span>{p.label}</span></button>; }

function AuthPage({ mode, setMode, onUser }: { mode: string; setMode: (m: string) => void; onUser: (u: UserT) => void }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [displayName, setDisplayName] = useState(''), [error, setError] = useState('');
  async function submit(e: React.FormEvent) { e.preventDefault(); setError(''); try { const data = await api('/auth/' + mode, { method: 'POST', body: JSON.stringify(mode === 'register' ? { email, password, displayName } : { email, password }) }); onUser(data.user); } catch (err: any) { setError(err.message); } }
  return <div className="auth"><form onSubmit={submit}><h1>{mode === 'login' ? 'Einloggen' : 'Registrieren'}</h1><p>Bitte gib deine eigenen Zugangsdaten ein.</p>{error && <div className="error">{error}</div>}{mode === 'register' && <label>Name<input value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" /></label>}<label>E-Mail<input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" /></label><label>Passwort<input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label><button className="primary" type="submit">{mode === 'login' ? 'Login' : 'Account erstellen'}</button><button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Schon registriert? Login'}</button></form></div>;
}

function CreatePuzzlePanel({ images, refresh, nav, setActiveProject, setError }: any) {
  const [imageId, setImageId] = useState(images[0]?.id ?? ''), [title, setTitle] = useState(''), [rows, setRows] = useState(4), [columns, setColumns] = useState(4), [visibility, setVisibility] = useState<'private' | 'public'>('private');
  useEffect(() => { if (!imageId && images[0]) setImageId(images[0].id); }, [images, imageId]);
  async function create() { if (!imageId) return setError('Bitte zuerst ein Bild hochladen.'); try { const d = await api('/puzzles/generate', { method: 'POST', body: JSON.stringify({ imageId, title: title || 'Neues Puzzle', rows, columns, difficulty: 'medium', pieceShape: 'classic', visibility }) }); setActiveProject(d.project); await refresh(); nav('play'); } catch (e: any) { setError(e.message); } }
  return <div className="creator"><h2>Neues Puzzle erstellen</h2><select value={imageId} onChange={e => setImageId(e.target.value)}>{images.map((i: ImageT) => <option key={i.id} value={i.id}>{i.originalFileName}</option>)}</select><input placeholder="Puzzle-Titel" value={title} onChange={e => setTitle(e.target.value)} /><label>Zeilen<input type="number" min={2} max={20} value={rows} onChange={e => setRows(Number(e.target.value))} /></label><label>Spalten<input type="number" min={2} max={20} value={columns} onChange={e => setColumns(Number(e.target.value))} /></label><select value={visibility} onChange={e => setVisibility(e.target.value as 'private' | 'public')}><option value="private">Nur für meinen Account</option><option value="public">Für alle Nutzer verfügbar</option></select><button className="primary" onClick={create}>Puzzle generieren</button></div>;
}

function Dashboard({ user, images, projects, refresh, nav, setActiveProject, setError }: any) {
  const fileRef = useRef<HTMLInputElement>(null); const own = projects.filter((p: Project) => p.ownerId === user.id); const published = own.filter((p: Project) => p.visibility === 'public').length; const drafts = own.filter((p: Project) => p.status !== 'generated').length;
  async function upload(f?: File) { if (!f) return; const fd = new FormData(); fd.append('image', f); try { await api('/images/upload', { method: 'POST', body: fd }); await refresh(); } catch (e: any) { setError(e.message); } }
  return <><header className="top"><div><h1>Willkommen zurück, {user.displayName}!</h1><p>Hier ist dein echter Puzzle-Überblick aus der Datenbank.</p></div><button className="primary" onClick={() => images.length ? document.getElementById('creator')?.scrollIntoView({ behavior: 'smooth' }) : fileRef.current?.click()}>+ Neues Puzzle erstellen</button></header><div className="kpis">{[['Puzzles insgesamt', own.length], ['Für alle Nutzer', published], ['Entwürfe', drafts], ['Hochgeladene Bilder', images.length]].map(x => <div className="kpi" key={x[0]}><b>{x[1]}</b><span>{x[0]}</span></div>)}</div><div className="drop" onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files[0]); }}><Upload /><b>Bild hochladen</b><span>JPG/PNG/WEBP bis 10 MB</span><input hidden ref={fileRef} type="file" accept="image/*" onChange={e => upload(e.target.files?.[0])} /></div>{images.length > 0 && <div id="creator"><CreatePuzzlePanel images={images} refresh={refresh} nav={nav} setActiveProject={setActiveProject} setError={setError} /></div>}<h2>Deine letzten Puzzles <button className="link" onClick={() => nav('puzzles')}>Alle anzeigen</button></h2><div className="grid cards">{own.slice(0, 4).map((p: Project) => <PuzzleCard key={p.id} p={p} currentUserId={user.id} onClick={() => { setActiveProject(p); nav('play'); }} />)}</div>{own.length === 0 && <p className="empty">Noch keine eigenen Puzzles. Lade ein Bild hoch und erstelle dein erstes Puzzle.</p>}</>;
}

function Images({ images, refresh, setError }: any) {
  const [q, setQ] = useState(''), [sort, setSort] = useState('new'), [grid, setGrid] = useState(true); const ref = useRef<HTMLInputElement>(null);
  const list = useMemo(() => images.filter((i: ImageT) => i.originalFileName.toLowerCase().includes(q.toLowerCase())).sort((a: ImageT, b: ImageT) => sort === 'new' ? Date.parse(b.createdAt) - Date.parse(a.createdAt) : Date.parse(a.createdAt) - Date.parse(b.createdAt)), [images, q, sort]);
  async function upload(f?: File) { if (!f) return; const fd = new FormData(); fd.append('image', f); try { await api('/images/upload', { method: 'POST', body: fd }); await refresh(); } catch (e: any) { setError(e.message); } }
  async function del(id: string) { if (confirm('Bild wirklich löschen?')) { await api('/images/' + id, { method: 'DELETE' }); await refresh(); } }
  return <><header className="top"><h1>Bildverwaltung</h1><button className="primary" onClick={() => ref.current?.click()}>+ Bilder hochladen</button><input hidden ref={ref} type="file" accept="image/*" onChange={e => upload(e.target.files?.[0])} /></header><div className="toolbar"><input placeholder="Suche" value={q} onChange={e => setQ(e.target.value)} /><select><option>Eigene Bilder</option></select><select value={sort} onChange={e => setSort(e.target.value)}><option value="new">Neueste</option><option value="old">Älteste</option></select><button onClick={() => setGrid(!grid)}><Grid2X2 /> {grid ? 'Grid' : 'List'}</button></div><div className={grid ? 'imagegrid' : 'imagelist'}>{list.map((i: ImageT) => <div className="imagecard" key={i.id}><a href={'http://localhost:8000' + i.url} target="_blank"><img src={'http://localhost:8000' + i.url} /></a><b>{i.originalFileName}</b><small>{i.width}×{i.height} · {i.status}</small><button onClick={() => del(i.id)}>Löschen</button></div>)}</div>{!list.length && <p className="empty">Keine Beispielbilder mehr: Hier erscheinen nur echte Bilder aus deiner Datenbank.</p>}</>;
}

function Puzzles({ user, projects, images, refresh, nav, setActiveProject, setError }: any) {
  async function del(id: string) { if (confirm('Puzzle löschen?')) { await api('/puzzles/' + id, { method: 'DELETE' }); await refresh(); } }
  return <><header className="top"><h1>Puzzles</h1></header>{images.length > 0 && <CreatePuzzlePanel images={images} refresh={refresh} nav={nav} setActiveProject={setActiveProject} setError={setError} />}<div className="grid cards">{projects.map((p: Project) => <PuzzleCard key={p.id} p={p} currentUserId={user.id} onClick={() => { setActiveProject(p); nav('play'); }} onDelete={p.ownerId === user.id ? () => del(p.id) : undefined} />)}</div>{!projects.length && <p className="empty">Noch keine Puzzles. Lade ein Bild hoch und erstelle dein erstes Puzzle.</p>}</>;
}
function PuzzleCard({ p, onClick, onDelete, currentUserId }: any) { return <div className="pcard" onClick={onClick}>{p.generated?.previewUrl && <img src={'http://localhost:8000' + p.generated.previewUrl} />}<b>{p.title}</b><span className={p.visibility === 'public' ? 'pill green' : 'pill purple'}>{p.visibility === 'public' ? 'Für alle Nutzer' : 'Privat'}</span><small>{p.ownerId === currentUserId ? 'Eigenes Puzzle' : 'Öffentliches Puzzle'} · {Math.round(p.savedState?.progressPercent ?? 0)}% Fortschritt</small>{onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(); }}>Löschen</button>}</div>; }


function edgeSign(a: number, b: number) { return ((a * 37 + b * 17 + 11) % 2 === 0) ? 1 : -1; }
function pieceTabs(pc: Piece, rows: number, columns: number) {
  return {
    top: pc.row === 0 ? 0 : -edgeSign(pc.row - 1, pc.column),
    right: pc.column === columns - 1 ? 0 : edgeSign(pc.row, pc.column),
    bottom: pc.row === rows - 1 ? 0 : edgeSign(pc.row, pc.column + 1000),
    left: pc.column === 0 ? 0 : -edgeSign(pc.row, pc.column - 1),
  };
}
function edgePath(side: 'top' | 'right' | 'bottom' | 'left', sign: number, w: number, h: number, k: number) {
  const neck = side === 'top' || side === 'bottom' ? w * 0.34 : h * 0.34;
  const neck2 = side === 'top' || side === 'bottom' ? w * 0.66 : h * 0.66;
  const mid = side === 'top' || side === 'bottom' ? w * 0.5 : h * 0.5;
  const r = side === 'top' || side === 'bottom' ? w * 0.16 : h * 0.16;
  if (sign === 0) {
    if (side === 'top') return `L ${k + w} ${k}`;
    if (side === 'right') return `L ${k + w} ${k + h}`;
    if (side === 'bottom') return `L ${k} ${k + h}`;
    return `L ${k} ${k}`;
  }
  if (side === 'top') {
    const y = k, out = y - sign * k * 0.92;
    return `L ${k + neck} ${y} C ${k + neck} ${y} ${k + mid - r} ${out} ${k + mid} ${out} C ${k + mid + r} ${out} ${k + neck2} ${y} ${k + neck2} ${y} L ${k + w} ${y}`;
  }
  if (side === 'right') {
    const x = k + w, out = x + sign * k * 0.92;
    return `L ${x} ${k + neck} C ${x} ${k + neck} ${out} ${k + mid - r} ${out} ${k + mid} C ${out} ${k + mid + r} ${x} ${k + neck2} ${x} ${k + neck2} L ${x} ${k + h}`;
  }
  if (side === 'bottom') {
    const y = k + h, out = y + sign * k * 0.92;
    return `L ${k + neck2} ${y} C ${k + neck2} ${y} ${k + mid + r} ${out} ${k + mid} ${out} C ${k + mid - r} ${out} ${k + neck} ${y} ${k + neck} ${y} L ${k} ${y}`;
  }
  const x = k, out = x - sign * k * 0.92;
  return `L ${x} ${k + neck2} C ${x} ${k + neck2} ${out} ${k + mid + r} ${out} ${k + mid} C ${out} ${k + mid - r} ${x} ${k + neck} ${x} ${k + neck} L ${x} ${k}`;
}
function piecePath(pc: Piece, rows: number, columns: number, w: number, h: number, k: number) {
  const t = pieceTabs(pc, rows, columns);
  return `M ${k} ${k} ${edgePath('top', t.top, w, h, k)} ${edgePath('right', t.right, w, h, k)} ${edgePath('bottom', t.bottom, w, h, k)} ${edgePath('left', t.left, w, h, k)} Z`;
}
function PieceSvg({ pc, st, pieceW, pieceH, knob, rows, columns, previewUrl, selected, onPointerDown, onPointerMove, onPointerUp, onDoubleClick }: any) {
  const path = piecePath(pc, rows, columns, pieceW, pieceH, knob);
  const clipId = `clip-${pc.id}`;
  return <svg className={(selected ? 'dragpiece selected' : 'dragpiece') + (st?.placed ? ' placed' : '')} style={{ left: (st?.x ?? pc.currentX) - knob, top: (st?.y ?? pc.currentY) - knob, width: pieceW + knob * 2, height: pieceH + knob * 2, transform: `rotate(${st?.rotation ?? 0}deg)` }} viewBox={`0 0 ${pieceW + knob * 2} ${pieceH + knob * 2}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={onDoubleClick}>
    <defs><clipPath id={clipId}><path d={path} /></clipPath></defs>
    <image href={previewUrl} x={-(pc.column * pieceW) + knob} y={-(pc.row * pieceH) + knob} width={900} height={600} clipPath={`url(#${clipId})`} preserveAspectRatio="none" />
    <path d={path} className="piece-outline" />
  </svg>;
}

function Play({ project, refresh, nav, setError }: any) {
  const pieces = project.generated?.pieces ?? [];
  const cfg = project.configuration ?? { rows: 4, columns: 4 };
  const pieceW = 900 / cfg.columns, pieceH = 600 / cfg.rows;
  const knob = Math.min(pieceW, pieceH) * 0.24;
  const snap = parseSnapshot(project);
  const previewUrl = `http://localhost:8000${project.generated?.previewUrl}`;
  const [zoom, setZoom] = useState(Math.round((snap.zoom ?? 0.78) * 100));
  const [seconds, setSeconds] = useState(snap.timerSeconds ?? 0);
  const [saved, setSaved] = useState('Bereit');
  const [selected, setSelected] = useState<string | null>(snap.selectedPieceId ?? null);
  const [tolerance, setTolerance] = useState(snap.tolerance ?? 42);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const trayCols = pieceW > 150 ? 3 : Math.max(4, Math.min(10, Math.ceil(Math.sqrt(pieces.length * 1.8))));
  const trayX = 24, trayY = 650, trayGapX = Math.max(78, Math.min(285, pieceW + knob * 1.15)), trayGapY = Math.max(72, Math.min(245, pieceH + knob * 0.95));
  const [pieceStates, setPieceStates] = useState<Record<string, PieceState>>(() => Object.fromEntries(pieces.map((p: Piece, idx: number) => [p.id, { x: snap.pieces?.[p.id]?.x ?? trayX + (idx % trayCols) * trayGapX, y: snap.pieces?.[p.id]?.y ?? trayY + Math.floor(idx / trayCols) * trayGapY, rotation: snap.pieces?.[p.id]?.rotation ?? ((idx % 4) * 90), placed: snap.pieces?.[p.id]?.placed ?? false }] as const))); 
  useEffect(() => { const t = setInterval(() => setSeconds((sec: number) => sec + 1), 1000); return () => clearInterval(t); }, []);
  const placedCount = Object.values(pieceStates).filter(p => p.placed).length; const progress = pieces.length ? placedCount / pieces.length * 100 : 0;
  function normalize(r: number) { return ((r % 360) + 360) % 360; }
  function rotDistance(r: number) { const n = normalize(r); return Math.min(n, 360 - n); }
  function updatePiece(id: string, patch: Partial<PieceState>) { setPieceStates(s => ({ ...s, [id]: { ...s[id], ...patch } })); }
  function select(id: string) { setSelected(id); }
  function onPointerDown(e: React.PointerEvent, id: string) { const st = pieceStates[id]; setSelected(id); drag.current = { id, dx: e.clientX - st.x, dy: e.clientY - st.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
  function onPointerMove(e: React.PointerEvent) { if (!drag.current) return; const id = drag.current.id; updatePiece(id, { x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy, placed: false }); }
  function trySnap(id: string) { const pc = pieces.find((p: Piece) => p.id === id); const st = pieceStates[id]; if (!pc || !st) return false; const dx = st.x - pc.targetX, dy = st.y - pc.targetY; const dist = Math.hypot(dx, dy); const rotOk = rotDistance(st.rotation) <= Math.max(10, tolerance * 0.35); if (dist <= tolerance && rotOk) { updatePiece(id, { x: pc.targetX, y: pc.targetY, rotation: 0, placed: true }); setSaved('Teil eingerastet ✓'); return true; } return false; }
  function onPointerUp() { if (!drag.current) return; trySnap(drag.current.id); drag.current = null; }
  function rotateSelected(deltaY: number) { if (!selected) return; const nextRot = (pieceStates[selected].rotation ?? 0) + (deltaY < 0 ? -15 : 15); updatePiece(selected, { rotation: nextRot, placed: false }); setTimeout(() => trySnap(selected), 0); }
  function shuffleTray() { setPieceStates(s => Object.fromEntries(pieces.map((p: Piece, idx: number) => [p.id, { ...s[p.id], x: trayX + (idx % trayCols) * trayGapX, y: trayY + Math.floor(idx / trayCols) * trayGapY, placed: false }] as const))); }
  async function save(auto = false) { try { setSaved(auto ? 'Autosave…' : 'Speichern…'); await api(`/puzzles/${project.id}/progress`, { method: 'PUT', body: JSON.stringify({ snapshot: { pieces: pieceStates, zoom: zoom / 100, timerSeconds: seconds, selectedPieceId: selected, tolerance }, progressPercent: progress }) }); setSaved(auto ? 'Autosave gespeichert' : 'Gespeichert'); await refresh(); } catch (e: any) { setError(e.message); } }
  useEffect(() => { const t = setInterval(() => save(true), 20000); return () => clearInterval(t); });
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0'), ss = String(seconds % 60).padStart(2, '0');
  return <div className="play"><button className="link" onClick={() => nav('dashboard')}>← Zurück zum Dashboard</button><header className="top"><div><h1>{project.title}</h1><p>{pieces.length} Teile · {project.visibility === 'public' ? 'Für alle Nutzer' : 'Privat'} · Anklicken/ziehen, Scrollrad dreht das ausgewählte Teil</p></div><b className="timer">00:{mm}:{ss}</b><button onClick={() => save(false)}>Save</button><span className="save-state">{saved}</span></header><div className="playtools"><span>{placedCount}/{pieces.length} eingerastet</span><label>Akzeptanzbereich <input type="range" min="18" max="80" value={tolerance} onChange={e => setTolerance(Number(e.target.value))} /> {tolerance}px</label><button onClick={shuffleTray}>Teile neu ordnen</button></div><div className="workspace" onWheel={e => { e.preventDefault(); rotateSelected(e.deltaY); }}><div className="target" style={{ backgroundImage: `url(${previewUrl})`, transform: `scale(${zoom / 100})` }} /><div className="tray"><b>Teileablage</b><small>Klicke ein Teil im Fach an, ziehe es aufs Bild und rotiere mit dem Scrollrad.</small></div>{pieces.map((pc: Piece) => { const st = pieceStates[pc.id]; return <PieceSvg key={pc.id} pc={pc} st={st} pieceW={pieceW} pieceH={pieceH} knob={knob} rows={cfg.rows} columns={cfg.columns} previewUrl={previewUrl} selected={selected === pc.id} onPointerDown={(e: React.PointerEvent) => onPointerDown(e, pc.id)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={() => { updatePiece(pc.id, { rotation: 0 }); setTimeout(() => trySnap(pc.id), 0); }} />; })}</div><div className="bottom"><button onClick={() => alert('Hint: Wenn ein Teil nah genug am Ziel ist und fast richtig gedreht wurde, richtet es sich automatisch aus und rastet grün ein.')}>Hint</button><div className="strip">{pieces.slice(0, 20).map((pc: Piece) => <button key={pc.id} className={selected === pc.id ? 'mini active' : 'mini'} onClick={() => select(pc.id)}>{pc.row + 1}/{pc.column + 1}</button>)}</div><button onClick={() => setZoom(z => Math.max(45, z - 10))}><ZoomOut /></button><b>{zoom}%</b><button onClick={() => setZoom(z => Math.min(130, z + 10))}><ZoomIn /></button><button onClick={() => setZoom(78)}>Fit</button></div></div>;
}

function Account({ user, setUser, logout, setError }: any) { const [tab, setTab] = useState('profile'), [name, setName] = useState(user.displayName), [lang, setLang] = useState(user.language), [tz, setTz] = useState(user.timezone), [cur, setCur] = useState(''), [pw, setPw] = useState(''), [pw2, setPw2] = useState(''); async function saveProfile() { try { const d = await api('/users/me', { method: 'PATCH', body: JSON.stringify({ displayName: name, language: lang, timezone: tz }) }); setUser(d.user); } catch (e: any) { setError(e.message); } } async function savePw() { if (pw !== pw2) return setError('Passwörter stimmen nicht überein'); await api('/users/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword: cur, newPassword: pw }) }); alert('Passwort aktualisiert'); } async function del() { if (confirm('Konto wirklich endgültig löschen?')) { await api('/users/me', { method: 'DELETE' }); logout(); } } return <><header className="top"><h1>Accountverwaltung</h1></header><div className="tabs">{['profile', 'security', 'settings'].map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t === 'profile' ? 'Profil' : t === 'security' ? 'Sicherheit' : 'Einstellungen'}</button>)}</div>{tab === 'profile' && <div className="form"><div className="avatar big">{name[0]?.toUpperCase()}</div><button onClick={() => alert('Profilbild-Upload ist als Button verdrahtet.')}>Profilbild ändern</button><label>Name<input value={name} onChange={e => setName(e.target.value)} /></label><label>E-Mail<input disabled value={user.email} /></label><label>Sprache<input value={lang} onChange={e => setLang(e.target.value)} /></label><label>Zeitzone<input value={tz} onChange={e => setTz(e.target.value)} /></label><button className="primary" onClick={saveProfile}>Änderungen speichern</button></div>}{tab === 'security' && <div className="form"><label>Aktuelles Passwort<input type="password" value={cur} onChange={e => setCur(e.target.value)} /></label><label>Neues Passwort<input type="password" value={pw} onChange={e => setPw(e.target.value)} /></label><label>Passwort bestätigen<input type="password" value={pw2} onChange={e => setPw2(e.target.value)} /></label><button className="primary" onClick={savePw}>Passwort aktualisieren</button></div>}{tab === 'settings' && <div className="danger"><h2>Danger Zone</h2><p>Konto löschen entfernt Nutzer, Sessions, Bilder, Puzzle-Projekte und Fortschritte.</p><button onClick={del}>Konto löschen</button></div>}</>; }
