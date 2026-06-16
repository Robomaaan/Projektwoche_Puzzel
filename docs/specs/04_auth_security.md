# 04 Auth & Security

- Argon2id für Passwörter.
- Session-Token zufällig, DB speichert nur SHA-256 Hash.
- Cookie: `puzzlestudio_session`, HttpOnly, SameSite=Lax.
- Logout invalidiert Session serverseitig.
- Fehlerantworten enthalten keine Stacktraces.
- Upload-Dateinamen werden per UUID erzeugt.
