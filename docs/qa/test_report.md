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


## Nacharbeit Puzzlelogik / Dashboard / Auth - 2026-06-15

Zusätzliche Nutzeranforderungen umgesetzt:

- Login/Register-Felder sind leer; keine automatisch eingetragene Demo-Mail/Passwort mehr.
- Dashboard-KPIs zeigen echte Daten aus DB/User-Kontext:
  - eigene Puzzles insgesamt
  - eigene öffentliche Puzzles
  - eigene Entwürfe
  - eigene hochgeladene Bilder
- Fake-/Beispielbilder wurden aus der Bildverwaltung entfernt. Es werden nur echte Uploads angezeigt; echte Bilder sind per Klick öffnbar und löschbar.
- Beim Puzzle-Erstellen kann der Nutzer entscheiden:
  - `Nur für meinen Account`
  - `Für alle Nutzer verfügbar`
- Backend unterstützt öffentliche Puzzle-Projekte mit unabhängigen Spielständen pro Nutzer.
- Puzzle-Spielansicht überarbeitet:
  - echte einzelne Bildteile aus der Generierung
  - Drag-and-drop per Pointer Events
  - Teil anklicken/auswählen
  - Scrollrad hoch = links herum rotieren
  - Scrollrad runter = rechts herum rotieren
  - Doppelklick setzt Rotation auf 0°
  - Teile rasten ein, wenn Position nah am Ziel und Rotation korrekt ist
  - Save/Autosave speichert Position, Rotation, Zoom, Timer und Auswahl

Zusätzliche Tests:

| Prüfung | Ergebnis |
|---|---|
| Private Puzzle bleiben für andere Nutzer unsichtbar | PASS |
| Öffentliche Puzzle sind für andere Nutzer lesbar | PASS |
| Öffentliche Puzzle haben pro Nutzer unabhängigen Fortschritt | PASS |
| Browser-Smoke Register -> Canvas-Upload -> Generate Public Puzzle -> Play -> Save | PASS |

Erneut ausgeführt:

- `npm run db:push` PASS
- `npm run lint` PASS
- `npm run test` PASS, Backend 4/4, Frontend 1/1
- `npm run build` PASS
- Browser-Konsole ohne JS-Errors


## Nacharbeit echte Jigsaw-Schnittformen / Akzeptanzbereich / Ablage - 2026-06-15

Zusätzliche Anforderungen umgesetzt:

- Puzzleteile werden in der Spielansicht als SVG-Jigsaw-Formen gerendert.
- Innere Kanten verwenden deterministische Tab-/Blank-Logik, sodass Nachbarteile komplementäre Noppen/Einbuchtungen haben.
- Außenkanten bleiben gerade.
- Jedes Teil nutzt denselben Bildausschnitt aus dem Gesamtbild mit ClipPath, damit die Teile visuell zusammenpassen.
- Akzeptanzbereich ist in der UI regelbar, Startwert 42px.
- Wenn ein Teil nahe genug am Ziel liegt und fast korrekt rotiert ist, dreht es automatisch auf 0° und rastet an Zielposition ein.
- Eingerastete Teile werden grün hervorgehoben und zählen im Fortschritt.
- Teileablage wurde von der seitlichen engen Spalte auf einen sichtbaren Ablagebereich unter dem Board umgebaut.
- Button „Teile neu ordnen“ legt die Teile übersichtlicher im Ablagebereich aus.

Erneut ausgeführt:

- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run test` PASS, Backend 4/4, Frontend 1/1
- `npm run build` PASS
- Browser-Visual-Smoke: SVG-Jigsaw-Teile sichtbar, Ablage sichtbar, keine JS-Errors.


## Nacharbeit Vollbildmodus / 90° Rotation / rechte Ablage - 2026-06-15

Zusätzliche Nutzeranforderungen umgesetzt:

- Puzzlemodus ist jetzt als Vollbild-Spielmodus umgesetzt (`position: fixed`, volle Viewport-Fläche).
- Browser-Fullscreen wird beim Öffnen nach Möglichkeit angefragt.
- Verlassen per `ESC` oder X-Button oben rechts.
- Scrollrad rotiert ausgewählte Puzzleteile jetzt ausschließlich in 90°-Rasterschritten.
- Der Puzzle-Workspace selbst scrollt nicht mehr vertikal; dadurch kollidiert Scrollrad-Rotation nicht mit Board-Scrolling.
- Teileablage liegt wieder rechts neben dem Bild, aber als eigener rechter Ablagebereich.
- Ablage kann intern scrollen, falls viele Teile vorhanden sind; das Board bleibt ruhig.

Erneut ausgeführt:

- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run test` PASS, Backend 4/4, Frontend 1/1
- `npm run build` PASS
- Browser-Smoke: Vollbildklasse aktiv, X-Button vorhanden, rechte Ablage vorhanden, Workspace overflow hidden, ESC führt zurück zum Dashboard.


## Nacharbeit Teilehaufen / Bildausblendung / Soft-Darkmode - 2026-06-15

Zusätzliche Nutzeranforderungen umgesetzt:

- Rechte Ablage ist jetzt ein Teilehaufen statt geordneter Rasterablage.
- Neue Puzzle-Teile starten übereinander/versetzt im rechten grünen Bereich mit 0/90/180/270°-Rotation.
- Button `Teilehaufen neu mischen` legt alle nicht gesetzten Teile wieder in den Haufen.
- Linker Puzzle-/Bildbereich ist visuell mit rotem Akzent markiert.
- Rechter Teilehaufenbereich ist visuell mit grünem Akzent markiert.
- Button `Puzzlebild ausblenden/einblenden` schaltet das sichtbare Referenzbild im Board um.
- Soft-Darkmode hinzugefügt.
- Dark/Light-Schieberegler sitzt links unten in der Sidebar direkt über dem Nutzerprofil.
- Toggle hat animierten Knob und persistiert via `localStorage`.

Erneut ausgeführt:

- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run test` PASS, Backend 4/4, Frontend 1/1
- `npm run build` PASS
- Browser-Smoke: Darkmode Toggle schaltet auf `body[data-theme=dark]`, Teilehaufen sichtbar, Preview-Ausblendung setzt `target hidden-preview`.


## Nacharbeit Toggle-Position / Haufen-Mischen / 3-zu-1-Flächenverhältnis - 2026-06-15

Zusätzliche Nutzeranforderungen umgesetzt:

- Dark/Light-Schieberegler sitzt jetzt knapp über dem Profil (`margin-bottom: 3mm`).
- `Teilehaufen neu mischen` lässt bereits korrekt platzierte/eingerastete Teile unverändert auf dem Puzzle liegen.
- Nur nicht platzierte Teile werden zurück in den Haufen gelegt und neu rotiert.
- Puzzlebereich/Teilebereich auf ca. 3/4 zu 1/4 angepasst: rechter Haufenbereich nutzt `25%`, Puzzlebereich bekommt den übrigen Hauptbereich.
- Fit-Zoom auf 88% angepasst, damit das Puzzle den linken Bereich stärker nutzt.

Erneut ausgeführt:

- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run test` PASS, Backend 4/4, Frontend 1/1
- `npm run build` PASS
- Browser-Smoke: rechter Tray ~25% Breite, Puzzlebereich links ~75%, Haufen-Button vorhanden, Toggle-Margin ~3mm.


## Nacharbeit Tray-Koordinaten und Zoom-Skalierung der Teile - 2026-06-15

Zusätzliche Nutzeranforderungen umgesetzt:

- Nicht platzierte Puzzleteile werden beim Laden/Mischen in den rechten Teilehaufenbereich normalisiert, wenn alte gespeicherte Positionen außerhalb des Trays lagen.
- Teilehaufen-Koordinaten werden aus der aktuellen Workspace-/Tray-Breite berechnet statt aus einer starren X-Position.
- Puzzleteile skalieren jetzt visuell mit dem Zoom des Puzzles.
- Bereits platzierte Teile werden beim Zoom an ihre skalierten Zielpositionen gerendert, damit sie auf dem Board ausgerichtet bleiben.
- Snap-Zielpositionen berücksichtigen den aktuellen Zoomfaktor.

Erneut ausgeführt:

- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run test` PASS, Backend 4/4, Frontend 1/1
- `npm run build` PASS
- Browser-Smoke: 16/16 neue Teile im rechten Traybereich; Zoom von 100% auf 110% vergrößert ein Teil von 297px auf 326.7px.
