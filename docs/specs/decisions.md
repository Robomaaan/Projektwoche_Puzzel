# Entscheidungen und Annahmen

- Keine Rückfragen; realistische Annahmen werden hier dokumentiert.
- Port 5173/8000 werden verwendet, Port 3000 nicht.
- Puzzle-Generierung erzeugt Raster-Teile technisch aus dem Bild und speichert Piece-Metadaten; die Spielansicht nutzt Drag/Drop-Simulation mit Persistenz.
- Version-Snapshots sind technische Meilensteinordner, keine manipulierte Git-Historie.
- Bei lokaler Demo wird SQLite unter `backend/data/puzzlestudio.sqlite` angelegt und nicht committet.

- Nach Nutzerfeedback werden keine Fake-KPIs oder Fake-Beispielbilder mehr angezeigt; Dashboard und Bildverwaltung basieren ausschließlich auf DB-Daten.
- Öffentliche Puzzle-Projekte sind sichtbar/spielbar für alle eingeloggten Nutzer, Fortschritte bleiben aber pro Nutzer getrennt.
- Puzzle-Interaktion nutzt Drag-and-drop plus Scrollrad-Rotation des ausgewählten Teils; Einrasten setzt nahe Zielposition und Rotation nahe 0° voraus.

- Jigsaw-Formen werden frontendseitig als SVG-ClipPaths aus dem Gesamtpreview berechnet; dadurch können Noppen/Einbuchtungen perfekt komplementär sein, ohne zusätzliche serverseitige Maskendateien.
- Der Akzeptanzbereich bleibt als UI-Slider einstellbar, weil die gewünschte Toleranz noch feinjustiert werden soll.
- Eingerastete Teile werden grün markiert; Snap erfolgt nur bei Nähe zur Zielposition und Rotation nahe 0°.
- Die Teileablage liegt unter dem Board statt rechts daneben, damit große Puzzleteile nicht in einer schmalen Spalte unbedienbar stapeln.

- Im Puzzlemodus wird Scrollen des Boards vermieden, weil das Scrollrad für 90°-Rotation reserviert ist.
- Teileablage liegt rechts neben dem Board als separater Tray; nur dieser Tray darf bei vielen Teilen intern scrollen.
- Rotation erfolgt ausschließlich in 90°-Schritten, um die Bedienung puzzletypisch und vorhersagbar zu halten.
- Puzzlemodus ist als Vollbild-Overlay umgesetzt; ESC oder X führen zurück zum Dashboard.

- Die rechte Puzzleablage ist bewusst ein überlappender Teilehaufen, damit sie sich wie ein echtes Puzzle anfühlt und weniger Raster-/Listencharakter hat.
- Das Referenzbild im Puzzleboard kann ausgeblendet werden, um den Schwierigkeitsgrad direkt im Spiel zu erhöhen.
- Darkmode wird clientseitig per `body[data-theme]` und `localStorage` umgesetzt; die Position des Toggles ist links unten oberhalb des Nutzerprofils.

- Der Button `Teilehaufen neu mischen` darf eingerastete Teile nicht mehr zurück in den Haufen legen; platzierte Teile gelten als stabiler Fortschritt.
- Das Vollbild-Puzzlelayout priorisiert das Board mit ca. 75% Breite und begrenzt den Teilehaufen auf ca. 25%.
- Der Theme-Toggle sitzt optisch knapp oberhalb des Profils, mit ca. 3mm Abstand.

- Die Teilehaufenpositionen werden aus der aktuellen Workspace-/Tray-Geometrie berechnet; alte gespeicherte unplatzierte Teile außerhalb des Trays werden beim Öffnen zurück in den Haufen normalisiert.
- Zoom verändert nicht nur das Referenzbild, sondern auch die visuelle Größe der Puzzleteile und die Snap-Zielpositionen.

- Snap-Autosave wird direkt beim Einrasten eines Teils ausgelöst, aber nicht awaited, damit Spielinteraktion nicht blockiert wird.
- Platzierte Teile behalten eine grüne Rückmeldung, aber mit schmalerer Umrandung, um das Bild weniger zu verdecken.
- Auth-Validierungsfehler werden als 400 mit sichtbaren Issues behandelt, nicht als generischer 500.

- Für die Vercel-Live-Seite wird Bild-Upload zuerst über Vercel API Routes und Supabase Storage (`puzzle-assets`) migriert; die Service-Role bleibt ausschließlich serverseitig in `/api`-Routen.
- Der Browser sendet für Storage-Upload/List/Delete nur den Supabase-Access-Token als Bearer-Auth und nutzt keine Service-Role-Secrets.
- Bis zur vollständigen DB-/Prisma-Migration liegen Bildmetadaten als JSON-Sidecar im Storage-Bucket neben dem Bildobjekt. Die nächste Stufe ist eine echte Postgres/Supabase-DB-Tabelle für Assets, Puzzle-Projekte und Fortschritte.
- Vercel-API-Helfer werden zentralisiert, damit Auth, Bucket-Konfiguration und Fehlerantworten bei der späteren Postgres-Migration nicht pro Route auseinanderlaufen.
- Das Supabase/Postgres-Schema wird zunächst als ausführbares SQL-Konzept dokumentiert und nicht automatisch gegen die Remote-DB gepusht, solange Pooler-/Circuit-Breaker-Risiken den funktionierenden Login gefährden könnten.
- Puzzle-Sichtbarkeit ist nachträglich nur durch den Besitzer änderbar; öffentliche Mitspieler dürfen lesen/spielen, aber weder Sichtbarkeit/Titel ändern noch löschen.
