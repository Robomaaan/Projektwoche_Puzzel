# 01 Requirements

## Muss
- React/TypeScript/Vite Frontend auf Port 5173.
- Express/TypeScript Backend auf Port 8000 mit `/health`.
- SQLite + Prisma.
- Login, Registrierung, Logout mit serverseitiger Session.
- Nutzer sehen nur eigene Bilder, Projekte und Fortschritte.
- Fortschritt ist nach erneutem Login fortsetzbar.
- Uploadvalidierung: Größe, MIME, Endung, Bild-Dimensionen/Verarbeitbarkeit.
- Alle sichtbaren Hauptbuttons haben Logik.

## Nicht-Ziele
- Docker/Container.
- Künstliche oder rückdatierte Git-Historie.
