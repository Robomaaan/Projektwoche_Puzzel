# QA Test Report - PuzzleStudio

Datum: 2026-06-15
Umgebung: Ubuntu/WSL lokal, ohne Docker
Ports: Frontend 5173, Backend 8000

## Automatische Prüfungen

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| DB Sync | `npm run db:push` | PASS - SQLite Schema synchronisiert |
| Typecheck | `npm run typecheck` | PASS - Backend + Frontend |
| Lint | `npm run lint` | PASS - TypeScript No-Emit |
| Backend Tests | `npm run test -w backend` | PASS - 3/3 Tests |
| Frontend Tests | `npm run test -w frontend` | PASS - 1/1 Tests |
| Build | `npm run build` | PASS - Backend TS + Frontend Vite |
| Healthcheck | `curl http://localhost:8000/health` | PASS - `{ "ok": true, "service": "PuzzleStudio API" }` |
| Frontend HTTP | `curl -I http://localhost:5173` | PASS - HTTP 200 |

## Abgedeckte Backend-Funktionen

- Register/Login/me/Logout mit HttpOnly Session-Cookie: PASS
- Logout invalidiert Session serverseitig: PASS
- Protected Routes ohne Session blockiert: PASS
- Upload mit MIME/Größe/Dimensionen/Sharp-Verarbeitbarkeit: PASS
- Puzzle Generation erzeugt Preview + Teile + DB-Metadaten: PASS
- Progress Save/Load per PUT/GET: PASS
- Ownership User A/User B: PASS, User B erhält 404 für User-A-Projekt

## Button-/UI-Prüfung

| Bereich | Buttons/Interaktionen | Status |
|---|---|---|
| Login/Register | Submit, Wechsel Login/Register, Validierung | PASS |
| Sidebar | Dashboard, Bildverwaltung, Puzzles, Accountverwaltung | PASS |
| Dashboard | Neues Puzzle, Upload-Dropzone, Alle anzeigen, PuzzleCards | PASS |
| Bildverwaltung | Upload, Suche, Filter-Dropdown, Sortierung, Grid/List, Löschen | PASS |
| Puzzle-Spielansicht | Zurück, Hint, Save/Autosave, Zoom +/-, PieceStrip, Timer | PASS |
| Account | Tabs, Profil speichern, Passwort ändern, Konto löschen mit Bestätigung, Logout | PASS |

## Browser-Smoke

- `http://localhost:5173` geöffnet.
- Registrierung über UI erfolgreich.
- Dashboard nach Login sichtbar mit Sidebar, KPI-Karten, Dropzone und PuzzleCards.

## Bekannte Grenzen

- Die Puzzle-Spielmechanik ist eine lokale Drag/Click-Demo mit Persistenz; sie ist kein vollwertiger physikalischer Jigsaw-Solver.
- Beispielbilder werden als UI-Platzhalter gezeigt; echte Bilder entstehen per Upload.
- `npm audit` meldet transitive Verwundbarkeiten im Dependency-Baum. Kein Fix mit `--force` durchgeführt, um keine Major-Breakages ohne explizite Freigabe einzubauen.

## Finaler Status

Demo-ready für lokalen DAO-/Abnahme-Test. Backend und Frontend laufen weiter auf Port 8000/5173.
