# Supabase Storage Datenfluss

Dieser Stand ergänzt den lokalen SQLite/Filesystem-Flow um einen optionalen Supabase-Storage-Adapter für Uploads, generierte Puzzle-Previews und einzelne Puzzle-Teile.

## Server-seitige Konfiguration

Benötigte Backend-Umgebungsvariablen:

- `SUPABASE_URL` – Projekt-URL, z. B. `https://<project>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` – nur serverseitig/API, niemals im Vite-Client
- `SUPABASE_STORAGE_BUCKET` – Bucket für Puzzle-Assets, z. B. `puzzle-assets`

Wenn eine dieser Variablen fehlt, bleibt der bestehende lokale Storage aktiv. Dadurch bleiben lokale Tests und Entwicklung ohne Supabase-Zugang stabil.

## Pfadmodell

Die Datenbank speichert weiterhin die vorhandenen `storagePath`-Felder:

- Lokal: absoluter Pfad unter `backend/storage/...`
- Supabase: URI im Format `supabase://<bucket>/<key>`

`publicFilePath()` wandelt Supabase-URIs in öffentliche Storage-URLs um. Der konfigurierte Bucket muss daher für die ausgelieferten Puzzle-Assets öffentlich lesbar sein oder später durch signierte URLs ersetzt werden.

## Flow

1. Bild-Upload wird wie bisher validiert und lokal gecached.
2. Bei aktivem Supabase-Adapter wird das Original zusätzlich nach `uploads/<uuid>.<ext>` hochgeladen und der Supabase-Pfad in `ImageUpload.storagePath` gespeichert.
3. Die Puzzle-Generierung kann lokale Pfade direkt lesen; Supabase-Pfade werden bei Bedarf in `storage/supabase-cache/` heruntergeladen.
4. Preview und Pieces werden lokal erzeugt, anschließend nach `previews/<projectId>.webp` und `generated/<projectId>/piece_<row>_<column>.webp` hochgeladen.
5. Puzzle-Metadaten, Sichtbarkeit und Fortschritt bleiben in Prisma-Modellen getrennt: Besitz entscheidet über Edit/Delete, `visibility=public` erlaubt Lesen, Fortschritt bleibt eindeutig pro `(projectId, ownerId)`.

## Postgres-Migration

Die Prisma-Schema-Datei nutzt aktuell weiterhin SQLite für lokale Stabilität. Für den nächsten Supabase/Postgres-Schritt ist ein Provider-Wechsel oder ein separates Deployment-Schema nötig. Secrets und echte Datenbank-URLs gehören ausschließlich in Backend-/Vercel-Umgebungen, nicht in den Browser-Build.
