# Vercel/Supabase-Postgres Vorbereitung

Ziel dieses Schritts: die Vercel-API-Routes so vorbereiten, dass sie ohne zusätzliche Secrets im Browser von Storage-Sidecars auf echte Postgres-Tabellen migriert werden können. Login bleibt über Supabase Auth; die Service-Role bleibt ausschließlich serverseitig in `/api`.

## Server-Runtime-Konfiguration

Erwartete Vercel-Variablen:

- `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` für den Browser-Login.
- `SUPABASE_URL` optional serverseitig; fällt auf `VITE_SUPABASE_URL` zurück.
- `SUPABASE_SERVICE_ROLE_KEY` nur serverseitig für Vercel API Routes.
- `SUPABASE_ASSET_BUCKET` optional, Standard: `puzzle-assets`.
- `UPLOAD_MAX_BYTES` optional, Standard: `10485760`.

Die Route `GET /api/health` meldet nur Konfigurations-Flags und Bucket-/Limit-Namen, aber keine Secret-Werte.

## Vorgeschlagenes Postgres-Datenmodell

Dieses SQL ist vorbereitend dokumentiert und noch nicht automatisch ausgeführt, damit der bestehende Login-/Upload-Erfolg nicht durch einen Pooler-/Circuit-Breaker-Fehler gefährdet wird.

```sql
create type public.processing_status as enum (
  'uploaded', 'validated', 'configured', 'processing', 'generated', 'failed', 'deleted'
);

create type public.project_visibility as enum ('private', 'public');

create table public.image_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  original_file_name text not null,
  storage_path text not null unique,
  meta_path text unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  width integer not null default 0 check (width >= 0),
  height integer not null default 0 check (height >= 0),
  status public.processing_status not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.puzzle_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  image_id uuid not null references public.image_uploads(id) on delete cascade,
  title text not null,
  status public.processing_status not null default 'configured',
  visibility public.project_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz
);

create table public.puzzle_configurations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.puzzle_projects(id) on delete cascade,
  rows integer not null check (rows between 2 and 20),
  columns integer not null check (columns between 2 and 20),
  difficulty text not null default 'medium',
  piece_shape text not null default 'classic',
  output_format text not null default 'web'
);

create table public.generated_puzzles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.puzzle_projects(id) on delete cascade,
  preview_path text not null,
  status public.processing_status not null default 'generated',
  generated_at timestamptz not null default now()
);

create table public.puzzle_pieces (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.generated_puzzles(id) on delete cascade,
  row_index integer not null check (row_index >= 0),
  column_index integer not null check (column_index >= 0),
  target_x double precision not null,
  target_y double precision not null,
  current_x double precision not null,
  current_y double precision not null,
  image_path text not null,
  is_placed boolean not null default false,
  unique (puzzle_id, row_index, column_index)
);

create table public.saved_puzzle_states (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.puzzle_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  snapshot_json jsonb not null default '{}'::jsonb,
  progress_percent double precision not null default 0 check (progress_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (project_id, owner_id)
);

create index image_uploads_owner_created_idx on public.image_uploads(owner_id, created_at desc);
create index puzzle_projects_owner_updated_idx on public.puzzle_projects(owner_id, updated_at desc);
create index puzzle_projects_public_updated_idx on public.puzzle_projects(updated_at desc) where visibility = 'public';
create index saved_puzzle_states_owner_idx on public.saved_puzzle_states(owner_id, updated_at desc);
```

## RLS-Policy-Skizze

Für Browser-Zugriff mit Supabase-Client gelten später diese Zugriffsideen. Vercel API Routes mit Service-Role können dieselben Regeln in Code erzwingen.

```sql
alter table public.image_uploads enable row level security;
alter table public.puzzle_projects enable row level security;
alter table public.puzzle_configurations enable row level security;
alter table public.generated_puzzles enable row level security;
alter table public.puzzle_pieces enable row level security;
alter table public.saved_puzzle_states enable row level security;

create policy image_owner_all on public.image_uploads
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy project_read_owner_or_public on public.puzzle_projects
  for select using (owner_id = auth.uid() or visibility = 'public');
create policy project_owner_write on public.puzzle_projects
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy state_owner_all on public.saved_puzzle_states
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```

Die Detailtabellen (`puzzle_configurations`, `generated_puzzles`, `puzzle_pieces`) sollen über `exists`-Policies an `puzzle_projects` gekoppelt werden: Lesen für Eigentümer oder öffentliche Projekte, Schreiben nur für Eigentümer.

## Migrationspfad

1. Tabellen in Supabase anlegen, sobald der direkte DB-Zugang stabil ist.
2. Upload-Route schreibt nach Storage zusätzlich `image_uploads`.
3. Listen-/Delete-Route liest zuerst Postgres, mit Sidecar-Fallback während der Migration.
4. Danach Puzzle-Projekt- und Fortschrittsrouten als Vercel API Routes ergänzen.
