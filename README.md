# PuzzleStudio

PuzzleStudio ist eine lokale Webanwendung für die Projektwoche 15.06.2026: Nutzer registrieren sich, laden eigene Bilder hoch, generieren daraus Puzzles und speichern ihren Spielstand zum Fortsetzen.

## Stack
- Frontend: React + TypeScript + Vite, Port 5173
- Backend: Node.js + TypeScript + Express, Port 8000
- DB: SQLite + Prisma
- Storage: lokales Dateisystem unter `backend/storage/*`
- Ohne Docker

## Start lokal
```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Frontend: http://localhost:5173  
Backend Health: http://localhost:8000/health

## Tests / QA
```bash
npm run typecheck
npm run lint
npm run test
npm run build
```
Der vollständige QA-Bericht liegt unter `docs/qa/test_report.md`.

## Sicherheit
- Session-Cookie ist HttpOnly und SameSite=Lax.
- Passwörter werden mit Argon2id gehasht.
- Private Ressourcen prüfen Ownership serverseitig.
- Lokale DB-Dateien, Uploads, generierte Assets, Logs, `.env`, `node_modules` und Builds werden nicht committet.
