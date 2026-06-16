# Entscheidungen und Annahmen

- Keine Rückfragen; realistische Annahmen werden hier dokumentiert.
- Port 5173/8000 werden verwendet, Port 3000 nicht.
- Puzzle-Generierung erzeugt Raster-Teile technisch aus dem Bild und speichert Piece-Metadaten; die Spielansicht nutzt Drag/Drop-Simulation mit Persistenz.
- Version-Snapshots sind technische Meilensteinordner, keine manipulierte Git-Historie.
- Bei lokaler Demo wird SQLite unter `backend/data/puzzlestudio.sqlite` angelegt und nicht committet.
