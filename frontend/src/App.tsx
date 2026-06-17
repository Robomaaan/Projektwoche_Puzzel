import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type User as SupabaseUser } from '@supabase/supabase-js';
import { Camera, Grid2X2, LayoutDashboard, LogOut, Puzzle, Settings, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import './styles.css';

type UserT = { id: string; email: string; displayName: string; language: string; timezone: string };
type ImageT = { id: string; ownerId: string; originalFileName: string; url: string; width: number; height: number; createdAt: string; status: string };
type Piece = { id: string; row: number; column: number; targetX: number; targetY: number; currentX: number; currentY: number; url: string; isPlaced: boolean };
type Project = { id: string; ownerId: string; title: string; status: string; visibility: 'private' | 'public'; updatedAt: string; image?: ImageT; configuration?: { rows: number; columns: number; difficulty: string }; generated?: { previewUrl: string; pieces: Piece[] }; savedState?: { progressPercent: number; snapshotJson: string } };
type PieceState = { x: number; y: number; rotation: number; placed: boolean };

const API = import.meta.env.VITE_API_URL || (location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://localhost:8000/api' : '/api');
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
function fromSupabaseUser(u: SupabaseUser): UserT { return { id: u.id, email: u.email ?? '', displayName: (u.user_metadata?.displayName || u.user_metadata?.name || u.email?.split('@')[0] || 'Nutzer') as string, language: 'de', timezone: 'Europe/Berlin' }; }
async function currentUser() { if (supabase) { const { data } = await supabase.auth.getUser(); return data.user ? fromSupabaseUser(data.user) : null; } const d = await api('/auth/me'); return d.user as UserT; }
async function signOutUser() { if (supabase) { await supabase.auth.signOut(); return; } await api('/auth/logout', { method: 'POST' }); }
export function friendlyAuthError(message: string, mode: 'login' | 'register') {
  const text = String(message || '').toLowerCase();
  if (text.includes('invalid login credentials')) return 'E-Mail oder Passwort stimmt nicht. Bitte prüfe deine Eingaben.';
  if (text.includes('email not confirmed')) return 'Diese E-Mail ist noch nicht bestätigt. Bitte registriere den Account erneut oder prüfe dein Postfach.';
  if (text.includes('already') || text.includes('registered') || text.includes('exists') || text.includes('bereits registriert')) return 'Diese E-Mail ist bereits registriert. Bitte wechsle zum Login.';
  if (text.includes('fetch') || text.includes('network') || text.includes('failed to fetch')) return 'Backend nicht erreichbar. Bitte Verbindung prüfen und erneut versuchen.';
  if (text.includes('supabase') && text.includes('konfiguriert')) return 'Supabase ist auf dem Server noch nicht vollständig konfiguriert.';
  if (mode === 'register' && !message) return 'Registrierung konnte nicht abgeschlossen werden.';
  return message || 'Login konnte nicht abgeschlossen werden.';
}
async function signInUser(email: string, password: string, displayName?: string) {
  const mode = displayName !== undefined ? 'register' : 'login';
  if (supabase) {
    if (displayName !== undefined) {
      let res: Response;
      try {
        res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, displayName }) });
      } catch {
        throw new Error(friendlyAuthError('failed to fetch', 'register'));
      }
      const created = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fallback = res.status === 404 ? 'Backend auf Vercel nicht verbunden. Registrierung ist aktuell nicht möglich.' : 'Registrierung konnte nicht abgeschlossen werden.';
        throw new Error(friendlyAuthError(created.error?.message || fallback, 'register'));
      }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(friendlyAuthError(error.message, mode));
    if (!data.user) throw new Error(friendlyAuthError('', mode));
    return fromSupabaseUser(data.user);
  }
  try {
    const data = await api('/auth/' + (displayName !== undefined ? 'register' : 'login'), { method: 'POST', body: JSON.stringify(displayName !== undefined ? { email, password, displayName } : { email, password }) });
    return data.user as UserT;
  } catch (error: any) {
    throw new Error(friendlyAuthError(error.message, mode));
  }
}
async function api(path: string, options: RequestInit = {}) {
  let res: Response;
  try {
    const headers = new Headers(options.headers || undefined);
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
    }
    res = await fetch(API + path, { credentials: 'include', ...options, headers });
  } catch {
    throw new Error('Backend nicht erreichbar. Bitte API-URL/VITE_API_URL prüfen.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok && (API === '/api' || API.endsWith('/api')) && res.status === 404) throw new Error('Backend auf Vercel nicht verbunden. Bitte VITE_API_URL auf eine öffentliche Backend-URL setzen.');
  if (!res.ok) throw new Error(data.error?.message || 'API Fehler');
  return data;
}
function assetUrl(url?: string) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  return 'http://localhost:8000' + url;
}
function getImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => { const dims = { width: img.naturalWidth, height: img.naturalHeight }; URL.revokeObjectURL(objectUrl); resolve(dims); };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve({ width: 0, height: 0 }); };
    img.src = objectUrl;
  });
}
async function uploadImageFile(file: File) {
  const dims = await getImageDimensions(file);
  const fd = new FormData();
  fd.append('image', file);
  fd.append('width', String(dims.width));
  fd.append('height', String(dims.height));
  return api('/images/upload', { method: 'POST', body: fd });
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');

  useEffect(() => { document.body.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { currentUser().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (user) { if (page === 'login' || page === 'register') { setPage('dashboard'); location.hash = 'dashboard'; } void refresh(); } }, [user]);
  async function refresh() { const [imgs, projs] = await Promise.all([api('/images').catch(() => ({ images: [] })), api('/puzzles').catch(() => ({ projects: [] }))]); setImages(imgs.images); setProjects(projs.projects); }
  function nav(p: string) { setPage(p); location.hash = p; setError(''); }
  async function logout() { await signOutUser(); setUser(null); setPage('login'); }

  if (loading) return <div className="center">Lade PuzzleStudio…</div>;
  if (!user) return <AuthPage mode={page === 'register' ? 'register' : 'login'} setMode={setPage} onUser={setUser} />;
  const currentPage = ['dashboard', 'images', 'puzzles', 'play', 'account'].includes(page) ? page : 'dashboard';
  const ctx = { user, images, projects, refresh, nav, setError, setActiveProject };
  return <div className="app"><aside className="sidebar"><div className="brand"><span className="logo">✣</span><b>PuzzleStudio</b></div><nav><Nav icon={<LayoutDashboard />} label="Dashboard" page="dashboard" cur={currentPage} nav={nav} /><Nav icon={<Camera />} label="Bildverwaltung" page="images" cur={currentPage} nav={nav} /><Nav icon={<Puzzle />} label="Puzzles" page="puzzles" cur={currentPage} nav={nav} /><Nav icon={<Settings />} label="Accountverwaltung" page="account" cur={currentPage} nav={nav} /></nav><ThemeToggle theme={theme} setTheme={setTheme} /><div className="profile"><div className="avatar">{user.displayName[0]?.toUpperCase()}</div><div><b>{user.displayName}</b><small>{user.email}</small></div><button title="Logout" onClick={logout}><LogOut size={16} /></button></div></aside><main className="main"><section className="card">{error && <div className="error">{error}</div>}{currentPage === 'dashboard' && <Dashboard {...ctx} />}{currentPage === 'images' && <Images {...ctx} />}{currentPage === 'puzzles' && <Puzzles {...ctx} />}{currentPage === 'play' && activeProject && <Play project={activeProject} refresh={refresh} nav={nav} setError={setError} />}{currentPage === 'account' && <Account user={user} setUser={setUser} logout={logout} setError={setError} />}</section></main></div>;
}
function ThemeToggle({ theme, setTheme }: { theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void }) { return <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Dark/Light Mode umschalten"><span className="theme-icon sun">☀</span><span className="theme-knob" /><span className="theme-icon moon">☾</span><b>{theme === 'dark' ? 'Dark' : 'Light'}</b></button>; }
function Nav(p: { icon: React.ReactNode; label: string; page: string; cur: string; nav: (x: string) => void }) { return <button className={p.cur === p.page ? 'active' : ''} onClick={() => p.nav(p.page)}>{p.icon}<span>{p.label}</span></button>; }

function AuthPage({ mode, setMode, onUser }: { mode: string; setMode: (m: string) => void; onUser: (u: UserT) => void }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [displayName, setDisplayName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const authMode = mode === 'register' ? 'register' : 'login';
  function switchMode(next: 'login' | 'register') { setError(''); setMode(next); location.hash = next; }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const user = await signInUser(email.trim(), password, authMode === 'register' ? displayName.trim() : undefined);
      onUser(user);
      location.hash = 'dashboard';
    } catch (err: any) {
      setError(friendlyAuthError(err.message, authMode));
    } finally {
      setBusy(false);
    }
  }
  return <div className="auth"><form onSubmit={submit}><h1>{authMode === 'login' ? 'Einloggen' : 'Registrieren'}</h1><p>Bitte gib deine eigenen Zugangsdaten ein.</p>{error && <div className="error" role="alert">{error}</div>}{authMode === 'register' && <label>Name<input required value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" disabled={busy} /></label>}<label>E-Mail<input required value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" disabled={busy} /></label><label>Passwort<input required minLength={6} value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} disabled={busy} /></label><button className="primary" type="submit" disabled={busy}>{busy ? 'Bitte warten…' : authMode === 'login' ? 'Login' : 'Account erstellen'}</button><button type="button" className="link" disabled={busy} onClick={() => switchMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Noch kein Konto? Registrieren' : 'Schon registriert? Login'}</button></form></div>;
}

function CreatePuzzlePanel({ images, refresh, nav, setActiveProject, setError }: any) {
  const [imageId, setImageId] = useState(images[0]?.id ?? ''), [title, setTitle] = useState(''), [rows, setRows] = useState(4), [columns, setColumns] = useState(4), [visibility, setVisibility] = useState<'private' | 'public'>('private');
  useEffect(() => { if (!imageId && images[0]) setImageId(images[0].id); }, [images, imageId]);
  async function create() { if (!imageId) return setError('Bitte zuerst ein Bild hochladen.'); try { const d = await api('/puzzles/generate', { method: 'POST', body: JSON.stringify({ imageId, title: title || 'Neues Puzzle', rows, columns, difficulty: 'medium', pieceShape: 'classic', visibility }) }); setActiveProject(d.project); await refresh(); nav('play'); } catch (e: any) { setError(e.message); } }
  return <div className="creator"><h2>Neues Puzzle erstellen</h2><select value={imageId} onChange={e => setImageId(e.target.value)}>{images.map((i: ImageT) => <option key={i.id} value={i.id}>{i.originalFileName}</option>)}</select><input placeholder="Puzzle-Titel" value={title} onChange={e => setTitle(e.target.value)} /><label>Zeilen<input type="number" min={2} max={20} value={rows} onChange={e => setRows(Number(e.target.value))} /></label><label>Spalten<input type="number" min={2} max={20} value={columns} onChange={e => setColumns(Number(e.target.value))} /></label><select value={visibility} onChange={e => setVisibility(e.target.value as 'private' | 'public')}><option value="private">Nur für meinen Account</option><option value="public">Für alle Nutzer verfügbar</option></select><button className="primary" onClick={create}>Puzzle generieren</button></div>;
}

function Dashboard({ user, images, projects, refresh, nav, setActiveProject, setError }: any) {
  const fileRef = useRef<HTMLInputElement>(null); const own = projects.filter((p: Project) => p.ownerId === user.id); const published = own.filter((p: Project) => p.visibility === 'public').length; const drafts = own.filter((p: Project) => p.status !== 'generated').length;
  async function upload(f?: File) { if (!f) return; try { await uploadImageFile(f); await refresh(); } catch (e: any) { setError(e.message); } }
  return <><header className="top"><div><h1>Willkommen zurück, {user.displayName}!</h1><p>Hier ist dein echter Puzzle-Überblick aus der Datenbank.</p></div><button className="primary" onClick={() => images.length ? document.getElementById('creator')?.scrollIntoView({ behavior: 'smooth' }) : fileRef.current?.click()}>+ Neues Puzzle erstellen</button></header><div className="kpis">{[['Puzzles insgesamt', own.length], ['Für alle Nutzer', published], ['Entwürfe', drafts], ['Hochgeladene Bilder', images.length]].map(x => <div className="kpi" key={x[0]}><b>{x[1]}</b><span>{x[0]}</span></div>)}</div><div className="drop" onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files[0]); }}><Upload /><b>Bild hochladen</b><span>JPG/PNG/WEBP bis 10 MB</span><input hidden ref={fileRef} type="file" accept="image/*" onChange={e => upload(e.target.files?.[0])} /></div>{images.length > 0 && <div id="creator"><CreatePuzzlePanel images={images} refresh={refresh} nav={nav} setActiveProject={setActiveProject} setError={setError} /></div>}<h2>Deine letzten Puzzles <button className="link" onClick={() => nav('puzzles')}>Alle anzeigen</button></h2><div className="grid cards">{own.slice(0, 4).map((p: Project) => <PuzzleCard key={p.id} p={p} currentUserId={user.id} onClick={() => { setActiveProject(p); nav('play'); }} />)}</div>{own.length === 0 && <p className="empty">Noch keine eigenen Puzzles. Lade ein Bild hoch und erstelle dein erstes Puzzle.</p>}</>;
}

function Images({ images, refresh, setError }: any) {
  const [q, setQ] = useState(''), [sort, setSort] = useState('new'), [grid, setGrid] = useState(true); const ref = useRef<HTMLInputElement>(null);
  const list = useMemo(() => images.filter((i: ImageT) => i.originalFileName.toLowerCase().includes(q.toLowerCase())).sort((a: ImageT, b: ImageT) => sort === 'new' ? Date.parse(b.createdAt) - Date.parse(a.createdAt) : Date.parse(a.createdAt) - Date.parse(b.createdAt)), [images, q, sort]);
  async function upload(f?: File) { if (!f) return; try { await uploadImageFile(f); await refresh(); } catch (e: any) { setError(e.message); } }
  async function del(id: string) { if (confirm('Bild wirklich löschen?')) { await api('/images/' + id, { method: 'DELETE' }); await refresh(); } }
  return <><header className="top"><h1>Bildverwaltung</h1><button className="primary" onClick={() => ref.current?.click()}>+ Bilder hochladen</button><input hidden ref={ref} type="file" accept="image/*" onChange={e => upload(e.target.files?.[0])} /></header><div className="toolbar"><input placeholder="Suche" value={q} onChange={e => setQ(e.target.value)} /><select><option>Eigene Bilder</option></select><select value={sort} onChange={e => setSort(e.target.value)}><option value="new">Neueste</option><option value="old">Älteste</option></select><button onClick={() => setGrid(!grid)}><Grid2X2 /> {grid ? 'Grid' : 'List'}</button></div><div className={grid ? 'imagegrid' : 'imagelist'}>{list.map((i: ImageT) => <div className="imagecard" key={i.id}><a href={assetUrl(i.url)} target="_blank"><img src={assetUrl(i.url)} /></a><b>{i.originalFileName}</b><small>{i.width}×{i.height} · {i.status}</small><button onClick={() => del(i.id)}>Löschen</button></div>)}</div>{!list.length && <p className="empty">Keine Beispielbilder mehr: Hier erscheinen nur echte Bilder aus deiner Datenbank.</p>}</>;
}

function Puzzles({ user, projects, images, refresh, nav, setActiveProject, setError }: any) {
  async function del(id: string) { if (confirm('Puzzle löschen?')) { await api('/puzzles/' + id, { method: 'DELETE' }); await refresh(); } }
  return <><header className="top"><h1>Puzzles</h1></header>{images.length > 0 && <CreatePuzzlePanel images={images} refresh={refresh} nav={nav} setActiveProject={setActiveProject} setError={setError} />}<div className="grid cards">{projects.map((p: Project) => <PuzzleCard key={p.id} p={p} currentUserId={user.id} onClick={() => { setActiveProject(p); nav('play'); }} onDelete={p.ownerId === user.id ? () => del(p.id) : undefined} />)}</div>{!projects.length && <p className="empty">Noch keine Puzzles. Lade ein Bild hoch und erstelle dein erstes Puzzle.</p>}</>;
}
function PuzzleCard({ p, onClick, onDelete, currentUserId }: any) { return <div className="pcard" onClick={onClick}>{p.generated?.previewUrl && <img src={assetUrl(p.generated.previewUrl)} />}<b>{p.title}</b><span className={p.visibility === 'public' ? 'pill green' : 'pill purple'}>{p.visibility === 'public' ? 'Für alle Nutzer' : 'Privat'}</span><small>{p.ownerId === currentUserId ? 'Eigenes Puzzle' : 'Öffentliches Puzzle'} · {Math.round(p.savedState?.progressPercent ?? 0)}% Fortschritt</small>{onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(); }}>Löschen</button>}</div>; }


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
function PieceSvg({ pc, st, pieceW, pieceH, knob, scale, rows, columns, previewUrl, selected, onPointerDown, onPointerMove, onPointerUp, onDoubleClick }: any) {
  const path = piecePath(pc, rows, columns, pieceW, pieceH, knob);
  const clipId = `clip-${pc.id}`;
  return <svg className={(selected ? 'dragpiece selected' : 'dragpiece') + (st?.placed ? ' placed' : '')} style={{ left: (st?.x ?? pc.currentX) - knob * scale, top: (st?.y ?? pc.currentY) - knob * scale, width: (pieceW + knob * 2) * scale, height: (pieceH + knob * 2) * scale, transform: `rotate(${st?.rotation ?? 0}deg)` }} viewBox={`0 0 ${pieceW + knob * 2} ${pieceH + knob * 2}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={onDoubleClick}>
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
  const previewUrl = assetUrl(project.generated?.previewUrl);
  const [zoom, setZoom] = useState(Math.round((snap.zoom ?? 0.88) * 100));
  const [seconds, setSeconds] = useState(snap.timerSeconds ?? 0);
  const [saved, setSaved] = useState('Bereit');
  const [selected, setSelected] = useState<string | null>(snap.selectedPieceId ?? null);
  const [tolerance, setTolerance] = useState(snap.tolerance ?? 42);
  const [showPreview, setShowPreview] = useState(snap.showPreview ?? true);
  const scale = zoom / 100;
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const boardX = 28, boardY = 96;
  const workspaceW = typeof window !== 'undefined' ? window.innerWidth - 44 : 1236;
  const trayX = workspaceW * 0.75 + 18, trayY = 128, trayW = workspaceW * 0.25 - 34;
  const displayPieceW = pieceW * scale, displayPieceH = pieceH * scale;
  function pileX(idx: number) { return trayX + trayW / 2 - displayPieceW / 2 + ((idx * 37) % Math.max(36, trayW * 0.36)) - Math.max(18, trayW * 0.18); }
  function pileY(idx: number) { return trayY + 205 + ((idx * 71) % 230) - 115; }
  function pileRot(idx: number) { return [0, 90, 180, 270][idx % 4]; }
  const [pieceStates, setPieceStates] = useState<Record<string, PieceState>>(() => Object.fromEntries(pieces.map((p: Piece, idx: number) => { const saved = snap.pieces?.[p.id]; const placed = saved?.placed ?? false; const savedInTray = saved && saved.x >= trayX - displayPieceW && saved.x <= trayX + trayW + displayPieceW; return [p.id, { x: placed ? boardX + p.targetX * scale : (savedInTray ? saved.x : pileX(idx)), y: placed ? boardY + p.targetY * scale : (savedInTray ? saved.y : pileY(idx)), rotation: saved?.rotation ?? pileRot(idx), placed }] as const; }))); 
  useEffect(() => { const t = setInterval(() => setSeconds((sec: number) => sec + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') nav('dashboard'); };
    window.addEventListener('keydown', onKey);
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    return () => { window.removeEventListener('keydown', onKey); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined); };
  }, []);
  const placedCount = Object.values(pieceStates).filter(p => p.placed).length; const progress = pieces.length ? placedCount / pieces.length * 100 : 0;
  function normalize(r: number) { return ((r % 360) + 360) % 360; }
  function rotDistance(r: number) { const n = normalize(r); return Math.min(n, 360 - n); }
  function progressFor(states: Record<string, PieceState>) { return pieces.length ? Object.values(states).filter(p => p.placed).length / pieces.length * 100 : 0; }
  function persistProgress(states: Record<string, PieceState>, auto = true) {
    if (!auto) setSaved('Speichern…');
    const body = JSON.stringify({ snapshot: { pieces: states, zoom: zoom / 100, timerSeconds: seconds, selectedPieceId: selected, tolerance, showPreview }, progressPercent: progressFor(states) });
    return api(`/puzzles/${project.id}/progress`, { method: 'PUT', body }).then(() => { setSaved(auto ? 'Automatisch gespeichert' : 'Gespeichert'); if (!auto) void refresh(); }).catch((e: any) => { setSaved('Autosave fehlgeschlagen'); if (!auto) setError(e.message); });
  }
  function updatePiece(id: string, patch: Partial<PieceState>) { setPieceStates(s => ({ ...s, [id]: { ...s[id], ...patch } })); }
  function select(id: string) { setSelected(id); }
  function onPointerDown(e: React.PointerEvent, id: string) { const st = pieceStates[id]; setSelected(id); drag.current = { id, dx: e.clientX - st.x, dy: e.clientY - st.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
  function onPointerMove(e: React.PointerEvent) { if (!drag.current) return; const id = drag.current.id; updatePiece(id, { x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy, placed: false }); }
  function trySnap(id: string) { const pc = pieces.find((p: Piece) => p.id === id); const st = pieceStates[id]; if (!pc || !st) return false; const targetX = boardX + pc.targetX * scale, targetY = boardY + pc.targetY * scale; const dx = st.x - targetX, dy = st.y - targetY; const dist = Math.hypot(dx, dy); const rotOk = rotDistance(st.rotation) <= Math.max(10, tolerance * 0.35); if (dist <= tolerance && rotOk) { const nextStates = { ...pieceStates, [id]: { ...st, x: targetX, y: targetY, rotation: 0, placed: true } }; setPieceStates(nextStates); setSaved('Teil eingerastet ✓ Speichere automatisch…'); void persistProgress(nextStates, true); return true; } return false; }
  function onPointerUp() { if (!drag.current) return; trySnap(drag.current.id); drag.current = null; }
  function rotateSelected(deltaY: number) { if (!selected) return; const nextRot = (pieceStates[selected].rotation ?? 0) + (deltaY < 0 ? -90 : 90); updatePiece(selected, { rotation: nextRot, placed: false }); setTimeout(() => trySnap(selected), 0); }
  function shuffleTray() { setPieceStates(s => Object.fromEntries(pieces.map((p: Piece, idx: number) => [p.id, s[p.id]?.placed ? s[p.id] : { ...s[p.id], x: pileX(idx), y: pileY(idx), rotation: pileRot(idx), placed: false }] as const))); }
  async function save(auto = false) { await persistProgress(pieceStates, auto); }
  useEffect(() => { const t = setInterval(() => save(true), 20000); return () => clearInterval(t); });
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0'), ss = String(seconds % 60).padStart(2, '0');
  return <div className="play fullscreen-play"><button className="exit-play" title="Puzzlemodus verlassen (ESC)" onClick={() => nav('dashboard')}>×</button><header className="top playtop"><div><h1>{project.title}</h1><p>{pieces.length} Teile · {project.visibility === 'public' ? 'Für alle Nutzer' : 'Privat'} · Teile rechts auswählen/ziehen, Scrollrad dreht in 90°-Schritten</p></div><b className="timer">00:{mm}:{ss}</b><button onClick={() => save(false)}>Save</button><span className="save-state">{saved}</span></header><div className="playtools"><span>{placedCount}/{pieces.length} eingerastet</span><label>Akzeptanzbereich <input type="range" min="18" max="80" value={tolerance} onChange={e => setTolerance(Number(e.target.value))} /> {tolerance}px</label><button onClick={shuffleTray}>Teilehaufen neu mischen</button><button onClick={() => setShowPreview(!showPreview)}>{showPreview ? 'Puzzlebild ausblenden' : 'Puzzlebild einblenden'}</button></div><div className="workspace" onWheel={e => { e.preventDefault(); rotateSelected(e.deltaY); }}><div className={showPreview ? 'target' : 'target hidden-preview'} style={{ left: boardX, top: boardY, backgroundImage: showPreview ? `url(${previewUrl})` : 'none', transform: `scale(${zoom / 100})` }} /><div className="tray pile-tray"><b>Teilehaufen</b><small>Alle Teile liegen absichtlich übereinander. Ziehe ein Teil aus dem Haufen ins Puzzle.</small></div>{pieces.map((pc: Piece) => { const st = pieceStates[pc.id]; return <PieceSvg key={pc.id} pc={pc} st={st?.placed ? { ...st, x: boardX + pc.targetX * scale, y: boardY + pc.targetY * scale } : st} pieceW={pieceW} pieceH={pieceH} knob={knob} scale={scale} rows={cfg.rows} columns={cfg.columns} previewUrl={previewUrl} selected={selected === pc.id} onPointerDown={(e: React.PointerEvent) => onPointerDown(e, pc.id)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={() => { updatePiece(pc.id, { rotation: 0 }); setTimeout(() => trySnap(pc.id), 0); }} />; })}</div><div className="bottom"><button onClick={() => alert('Hint: Wenn ein Teil nah genug am Ziel ist und fast richtig gedreht wurde, richtet es sich automatisch aus und rastet grün ein.')}>Hint</button><div className="strip">{pieces.slice(0, 20).map((pc: Piece) => <button key={pc.id} className={selected === pc.id ? 'mini active' : 'mini'} onClick={() => select(pc.id)}>{pc.row + 1}/{pc.column + 1}</button>)}</div><button onClick={() => setZoom(z => Math.max(45, z - 10))}><ZoomOut /></button><b>{zoom}%</b><button onClick={() => setZoom(z => Math.min(130, z + 10))}><ZoomIn /></button><button onClick={() => setZoom(88)}>Fit</button></div></div>;
}

function Account({ user, setUser, logout, setError }: any) { const [tab, setTab] = useState('profile'), [name, setName] = useState(user.displayName), [lang, setLang] = useState(user.language), [tz, setTz] = useState(user.timezone), [cur, setCur] = useState(''), [pw, setPw] = useState(''), [pw2, setPw2] = useState(''); async function saveProfile() { try { const d = await api('/users/me', { method: 'PATCH', body: JSON.stringify({ displayName: name, language: lang, timezone: tz }) }); setUser(d.user); } catch (e: any) { setError(e.message); } } async function savePw() { if (pw !== pw2) return setError('Passwörter stimmen nicht überein'); await api('/users/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword: cur, newPassword: pw }) }); alert('Passwort aktualisiert'); } async function del() { if (confirm('Konto wirklich endgültig löschen?')) { await api('/users/me', { method: 'DELETE' }); logout(); } } return <><header className="top"><h1>Accountverwaltung</h1></header><div className="tabs">{['profile', 'security', 'settings'].map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t === 'profile' ? 'Profil' : t === 'security' ? 'Sicherheit' : 'Einstellungen'}</button>)}</div>{tab === 'profile' && <div className="form"><div className="avatar big">{name[0]?.toUpperCase()}</div><button onClick={() => alert('Profilbild-Upload ist als Button verdrahtet.')}>Profilbild ändern</button><label>Name<input value={name} onChange={e => setName(e.target.value)} /></label><label>E-Mail<input disabled value={user.email} /></label><label>Sprache<input value={lang} onChange={e => setLang(e.target.value)} /></label><label>Zeitzone<input value={tz} onChange={e => setTz(e.target.value)} /></label><button className="primary" onClick={saveProfile}>Änderungen speichern</button></div>}{tab === 'security' && <div className="form"><label>Aktuelles Passwort<input type="password" value={cur} onChange={e => setCur(e.target.value)} /></label><label>Neues Passwort<input type="password" value={pw} onChange={e => setPw(e.target.value)} /></label><label>Passwort bestätigen<input type="password" value={pw2} onChange={e => setPw2(e.target.value)} /></label><button className="primary" onClick={savePw}>Passwort aktualisieren</button></div>}{tab === 'settings' && <div className="danger"><h2>Danger Zone</h2><p>Konto löschen entfernt Nutzer, Sessions, Bilder, Puzzle-Projekte und Fortschritte.</p><button onClick={del}>Konto löschen</button></div>}</>; }
