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
