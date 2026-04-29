# Supabase backend build spec — On-Nex Training Portal

> This is the **canonical spec** for promoting the portal from a browser-only
> prototype to a real multi-user backend. Implement it on Lovable Cloud
> (Supabase under the hood). Every section here is intended to be directly
> actionable: copy DDL into a migration, copy policies into the same migration,
> wire edge functions as named.

Read `CLAUDE.md` and `docs/README.md` first for the client-side context this
backend has to serve.

---

## 1. Goals

- **Persist lesson overrides server-side** so two editors see the same content.
- **Per-author drafts** that don't clobber one another.
- **Publish workflow** with audit trail and restorable history.
- **Image/PDF assets** in object storage with public read URLs.
- **Role-based access**: `admin`, `editor`, `student`. Students get read-only
  published content. Editors get draft + publish on lessons they own.
  Admins can publish anything and manage roles.
- **No client trust.** Every mutation goes through RLS or an edge function.

## 2. Roles

Roles live in their **own table**, never on `profiles`. We use a
`SECURITY DEFINER` helper to check membership without recursive RLS.

```sql
-- Enum
create type public.app_role as enum ('admin', 'editor', 'student');

-- Table (separate from profiles to prevent privilege escalation)
create table public.user_roles (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- SECURITY DEFINER avoids recursive policy evaluation
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- Self-read; only admins can change role assignments
create policy "user_roles: self read"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "user_roles: admin write"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
```

Default-on-signup: a trigger on `auth.users` inserts a `('student')` row. Admins
promote users via a small `/admin/users` UI (out of scope for this spec).

## 3. Schema

All `id` columns are `uuid default gen_random_uuid()`. All timestamps use
`timestamptz default now()`. All tables have RLS enabled.

### 3.1 `profiles`

```sql
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles: read all" on public.profiles for select to authenticated using (true);
create policy "profiles: self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
```

A trigger creates a `profiles` row on `auth.users` insert, mirroring `id` and
`raw_user_meta_data->>'name'`.

### 3.2 `lessons` (default catalogue)

```sql
create table public.lessons (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  kind         text not null check (kind in ('pre-work','lesson')),
  number       int,
  icon         text not null,
  title        text not null,
  summary      text not null,
  -- body_default is jsonb so it can be either {"_": "..."} or {"mac": "...", "windows": "...", "linux": "..."}
  body_default jsonb not null,
  order_index  int not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.lessons enable row level security;

create policy "lessons: public read" on public.lessons for select to anon, authenticated using (true);
create policy "lessons: editor write" on public.lessons for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

create index lessons_order on public.lessons(order_index);
```

### 3.3 `lesson_published`

One row per lesson; the live overlay students see.

```sql
create table public.lesson_published (
  id            uuid primary key default gen_random_uuid(),
  lesson_id     uuid not null unique references public.lessons(id) on delete cascade,
  title         text,
  summary       text,
  body          jsonb,
  published_by  uuid references auth.users(id),
  published_at  timestamptz not null default now()
);
alter table public.lesson_published enable row level security;

create policy "published: public read" on public.lesson_published for select to anon, authenticated using (true);
-- Writes go through the publish-draft edge function, but we still scope direct writes to admins for safety.
create policy "published: admin write" on public.lesson_published for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
```

### 3.4 `lesson_drafts`

Per-author working copy. Unique on `(lesson_id, author_id)`.

```sql
create table public.lesson_drafts (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  title       text,
  summary     text,
  body        jsonb,
  updated_at  timestamptz not null default now(),
  unique (lesson_id, author_id)
);
alter table public.lesson_drafts enable row level security;

create policy "drafts: own read" on public.lesson_drafts for select to authenticated
  using (author_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "drafts: own write" on public.lesson_drafts for all to authenticated
  using (
    author_id = auth.uid()
    and (public.has_role(auth.uid(),'editor') or public.has_role(auth.uid(),'admin'))
  )
  with check (
    author_id = auth.uid()
    and (public.has_role(auth.uid(),'editor') or public.has_role(auth.uid(),'admin'))
  );

create index drafts_author on public.lesson_drafts(author_id);
```

### 3.5 `lesson_snapshots`

Versioned history. Capped to 20 per `(lesson_id, author_id)` by trigger.

```sql
create type public.snapshot_kind as enum ('autosave','published','restore');

create table public.lesson_snapshots (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  title       text,
  summary     text,
  body        jsonb,
  kind        public.snapshot_kind not null,
  created_at  timestamptz not null default now()
);
alter table public.lesson_snapshots enable row level security;

create policy "snapshots: editor read" on public.lesson_snapshots for select to authenticated
  using (
    author_id = auth.uid()
    or public.has_role(auth.uid(),'admin')
    or kind = 'published'
  );
create policy "snapshots: insert by author or service" on public.lesson_snapshots for insert to authenticated
  with check (author_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- Cap at 20 per (lesson, author)
create or replace function public.cap_snapshots()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.lesson_snapshots
   where id in (
     select id from public.lesson_snapshots
      where lesson_id = new.lesson_id
        and coalesce(author_id::text,'') = coalesce(new.author_id::text,'')
      order by created_at desc
      offset 20
   );
  return new;
end $$;
create trigger trg_cap_snapshots
  after insert on public.lesson_snapshots
  for each row execute function public.cap_snapshots();
```

### 3.6 `activity_log`

```sql
create type public.activity_action as enum (
  'publish_single','publish_all','restore','delete_asset','role_change'
);

create table public.activity_log (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references auth.users(id) on delete set null,
  action          public.activity_action not null,
  lesson_id       uuid references public.lessons(id) on delete set null,
  title_snapshot  text,
  body_preview    text,
  metadata        jsonb,            -- e.g. { "count": 7 } for publish_all
  created_at      timestamptz not null default now()
);
alter table public.activity_log enable row level security;

create policy "activity: editor+admin read" on public.activity_log for select to authenticated
  using (public.has_role(auth.uid(),'editor') or public.has_role(auth.uid(),'admin'));
create policy "activity: insert by self" on public.activity_log for insert to authenticated
  with check (actor_id = auth.uid());

create index activity_recent on public.activity_log(created_at desc);
```

### 3.7 `assets`

```sql
create table public.assets (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  storage_path  text not null unique,        -- e.g. "<owner>/<uuid>.png"
  name          text not null,
  mime_type     text not null,
  size_bytes    bigint not null,
  created_at    timestamptz not null default now()
);
alter table public.assets enable row level security;

create policy "assets: read all (matches public bucket)" on public.assets for select to anon, authenticated using (true);
create policy "assets: editor write own" on public.assets for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (public.has_role(auth.uid(),'editor') or public.has_role(auth.uid(),'admin'))
  );
create policy "assets: editor delete own, admin delete any" on public.assets for delete to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or (owner_id = auth.uid() and public.has_role(auth.uid(),'editor'))
  );
```

### 3.8 Storage bucket: `lesson-assets`

Public read, authenticated write — but constrained per-user via storage policies.

```sql
insert into storage.buckets (id, name, public) values ('lesson-assets','lesson-assets', true)
on conflict (id) do nothing;

create policy "lesson-assets: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'lesson-assets');

create policy "lesson-assets: editor write own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lesson-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (public.has_role(auth.uid(),'editor') or public.has_role(auth.uid(),'admin'))
  );

create policy "lesson-assets: editor delete own; admin delete any"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'lesson-assets'
    and (
      public.has_role(auth.uid(),'admin')
      or ((storage.foldername(name))[1] = auth.uid()::text and public.has_role(auth.uid(),'editor'))
    )
  );
```

## 4. `updated_at` triggers

```sql
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_lessons_touch       before update on public.lessons        for each row execute function public.touch_updated_at();
create trigger trg_lesson_drafts_touch before update on public.lesson_drafts  for each row execute function public.touch_updated_at();
create trigger trg_profiles_touch      before update on public.profiles       for each row execute function public.touch_updated_at();
```

## 5. Edge functions (Lovable Cloud functions)

All functions run as the calling user (use the supplied `Authorization` header
and a Supabase client with `persistSession: false`). They re-check the role
inside the function in addition to RLS.

### 5.1 `publish-draft`

Input: `{ lessonId: uuid }`.
- Verify caller is `editor` or `admin`.
- Read the caller's draft for `lessonId`.
- Upsert into `lesson_published` (transaction).
- Insert a `published` snapshot.
- Insert an `activity_log` row (`publish_single`).
- Delete the draft row.

### 5.2 `publish-all`

Input: `{ lessonIds?: uuid[] }`. Default: all of caller's drafts.
- Same as above but in a loop, inside one transaction.
- Single `activity_log` row with `action='publish_all'` and `metadata={count:N}`.

### 5.3 `restore-snapshot`

Input: `{ snapshotId: uuid }`.
- Verify caller is `editor` (own snapshot) or `admin` (any).
- Upsert into `lesson_drafts` (caller's draft) with the snapshot's title/summary/body.
- Insert a `restore` snapshot to track the action.
- `activity_log` row with `action='restore'`.

### 5.4 `delete-asset`

Input: `{ assetId: uuid }`.
- Verify caller may delete it (admin, or editor + own).
- Compute usage by scanning `lesson_published.body || lesson_drafts.body` for `lov-img://<storage_path>`.
- If used, refuse with the list of referencing lesson titles.
- Otherwise delete from `storage.objects` then `assets`. Log `delete_asset`.

### 5.5 `import-from-localstorage` (one-shot migration)

Input: the JSON blob produced by the existing client-side **Export** action.
- Verify caller is `admin`.
- Upsert into `lessons` for any missing slugs (using compiled defaults shipped with the migration).
- Upsert into `lesson_published` for every entry in the JSON.
- Insert a `published` snapshot per entry attributed to the caller.

This is the bridge from the current localStorage world to Supabase, so editors
don't lose their work.

## 6. Client refactor checklist (after backend is live)

The React hooks must keep their signatures so component code is untouched:

| Module | Today | After |
|---|---|---|
| `contentStore.useLessons` | reads localStorage | reads `lesson_published` (joined onto `lessons`) |
| `contentStore.useDraftLessons` | reads localStorage | reads `lesson_drafts` for `auth.uid()`, merged onto published |
| `contentStore.publishDraft` | local promotion | calls `publish-draft` edge function |
| `activityLog.*` | localStorage cap | reads/writes `activity_log` |
| `draftHistory.*` | localStorage cap-20 | reads `lesson_snapshots`; writes by autosave still allowed (RLS-checked) |
| `imageStore.*` | IndexedDB blobs | uploads to `lesson-assets` bucket; embeds `lov-img://<storage_path>` |
| `assetUsage.computeReferencedIds` | scans local strings | postgres view or inline scan via edge function |
| `AdminContext` | localStorage flag | replaced by `has_role(auth.uid(),'admin'|'editor')` |

The legacy `vci.*` storage keys remain for one release as a fallback so an
in-flight editor doesn't lose drafts on the cutover; the migration function
above absorbs them on first admin login.

## 7. Indexes

```sql
create index activity_recent       on public.activity_log(created_at desc);
create index drafts_author         on public.lesson_drafts(author_id);
create index lessons_order         on public.lessons(order_index);
create index snapshots_recent      on public.lesson_snapshots(lesson_id, created_at desc);
```

## 8. Seed

The lessons in `src/content/lessons.ts` are the seed. Generate a one-shot SQL
migration that inserts each row into `public.lessons` with `body_default = jsonb_build_object(...)`.
The migration ships with the backend cutover.

## 9. Out of scope (future)

- Comments on snapshots / publish requests / approval workflow.
- Soft-delete + retention windows for assets.
- Per-cohort visibility (private lessons for specific student groups).
- Realtime collaboration on the markdown editor.

When implementing this spec, follow the conventions in `CLAUDE.md` and update
`docs/README.md` to flip the "no backend" notes to the new reality.
