-- JustLDRthings — initial schema, RLS, storage, and share-resolution functions.
-- Apply in the Supabase SQL editor (or via the Supabase CLI).
--
-- This file is RE-RUNNABLE. Tables use `if not exists`, functions use `create or
-- replace`, and bucket inserts use `on conflict do nothing`. Postgres has no
-- `create policy if not exists`, so every policy is preceded by `drop policy if
-- exists` — without that pairing, a second run fails on the first policy with
-- `42710: policy already exists` and every statement after it is skipped.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- pages
-- ---------------------------------------------------------------------------
create table if not exists public.pages (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  title      text not null default 'For You',
  status     text not null default 'draft' check (status in ('draft', 'published')),
  theme      text not null default 'classic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pages_owner_idx on public.pages (owner_id);

drop trigger if exists pages_set_updated_at on public.pages;
create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- content_items — reusable creations. Type + validated JSON payload.
-- ---------------------------------------------------------------------------
create table if not exists public.content_items (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  type         text not null check (type in
                 ('note', 'letter', 'song', 'coupon', 'media', 'voice', 'doodle', 'bouquet', 'collage')),
  title        text not null default '',
  payload_json jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists content_items_owner_idx on public.content_items (owner_id);

drop trigger if exists content_items_set_updated_at on public.content_items;
create trigger content_items_set_updated_at
  before update on public.content_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- page_items — which content items sit on a page, and in what order.
-- ---------------------------------------------------------------------------
create table if not exists public.page_items (
  id              uuid primary key default gen_random_uuid(),
  page_id         uuid not null references public.pages (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  sort_order      integer not null default 0,
  layout_json     jsonb not null default '{}'::jsonb,
  unique (page_id, content_item_id)
);
create index if not exists page_items_page_idx on public.page_items (page_id, sort_order);

-- ---------------------------------------------------------------------------
-- media_assets — private photo / video / audio backing media & voice items.
-- ---------------------------------------------------------------------------
create table if not exists public.media_assets (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  storage_path    text not null,
  media_type      text not null check (media_type in ('image', 'video', 'audio')),
  mime_type       text,
  size_bytes      bigint,
  created_at      timestamptz not null default now()
);
create index if not exists media_assets_item_idx on public.media_assets (content_item_id);

-- ---------------------------------------------------------------------------
-- coupons — redemption state lives here (stateful, so normalized).
-- ---------------------------------------------------------------------------
create table if not exists public.coupons (
  id              uuid primary key default gen_random_uuid(),
  content_item_id uuid not null unique references public.content_items (id) on delete cascade,
  coupon_text     text not null,
  expires_at      timestamptz,
  redeemed_at     timestamptz
);

-- ---------------------------------------------------------------------------
-- page_shares — one row per share token (we store a hash, never the raw token).
-- ---------------------------------------------------------------------------
create table if not exists public.page_shares (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references public.pages (id) on delete cascade,
  token_hash text not null unique,
  enabled    boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists page_shares_page_idx on public.page_shares (page_id);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles      enable row level security;
alter table public.pages         enable row level security;
alter table public.content_items enable row level security;
alter table public.page_items    enable row level security;
alter table public.media_assets  enable row level security;
alter table public.coupons       enable row level security;
alter table public.page_shares   enable row level security;

-- profiles: a user sees & edits only their own profile.
drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- pages: owner-only CRUD.
drop policy if exists "pages: owner all" on public.pages;
create policy "pages: owner all" on public.pages
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- content_items: owner-only CRUD.
drop policy if exists "content_items: owner all" on public.content_items;
create policy "content_items: owner all" on public.content_items
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- page_items: owner of the parent page only.
drop policy if exists "page_items: owner all" on public.page_items;
create policy "page_items: owner all" on public.page_items
  for all using (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  );

-- media_assets: owner-only CRUD.
drop policy if exists "media_assets: owner all" on public.media_assets;
create policy "media_assets: owner all" on public.media_assets
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- coupons: owner of the parent content item only (recipient redemption is via RPC).
drop policy if exists "coupons: owner all" on public.coupons;
create policy "coupons: owner all" on public.coupons
  for all using (
    exists (select 1 from public.content_items c where c.id = content_item_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.content_items c where c.id = content_item_id and c.owner_id = auth.uid())
  );

-- page_shares: owner of the parent page only.
drop policy if exists "page_shares: owner all" on public.page_shares;
create policy "page_shares: owner all" on public.page_shares
  for all using (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.pages p where p.id = page_id and p.owner_id = auth.uid())
  );

-- ===========================================================================
-- Recipient access (anonymous) via SECURITY DEFINER functions only.
-- No page/media rows are ever made public.
-- ===========================================================================

-- Resolve a valid share token into recipient-safe published page data.
create or replace function public.resolve_shared_page(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page   public.pages;
  v_result jsonb;
begin
  select p.* into v_page
  from public.page_shares s
  join public.pages p on p.id = s.page_id
  where s.token_hash = p_token_hash
    and s.enabled = true
    and (s.expires_at is null or s.expires_at > now())
    and p.status = 'published'
  limit 1;

  if v_page.id is null then
    return null;
  end if;

  select jsonb_build_object(
    'page', jsonb_build_object('title', v_page.title, 'theme', v_page.theme),
    'items', coalesce(jsonb_agg(item order by item_sort), '[]'::jsonb)
  )
  into v_result
  from (
    select
      pi.sort_order as item_sort,
      jsonb_build_object(
        'id',       ci.id,
        'type',     ci.type,
        'title',    ci.title,
        'payload',  ci.payload_json,
        'layout',   pi.layout_json,
        'media',    (
          select coalesce(jsonb_agg(jsonb_build_object(
                    'storage_path', ma.storage_path,
                    'media_type',   ma.media_type,
                    'mime_type',    ma.mime_type
                  )), '[]'::jsonb)
          from public.media_assets ma
          where ma.content_item_id = ci.id
        ),
        'coupon',   (
          select jsonb_build_object(
                    'id',          co.id,
                    'coupon_text', co.coupon_text,
                    'expires_at',  co.expires_at,
                    'redeemed_at', co.redeemed_at
                  )
          from public.coupons co
          where co.content_item_id = ci.id
        )
      ) as item
    from public.page_items pi
    join public.content_items ci on ci.id = pi.content_item_id
    where pi.page_id = v_page.id
  ) sub;

  return v_result;
end;
$$;

-- Redeem a coupon that belongs to a page shared through the given token.
create or replace function public.redeem_coupon(p_coupon_id uuid, p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons;
begin
  -- The coupon must belong to a content item that is placed on a published page
  -- that is currently shared (enabled, not expired) via this exact token.
  select co.* into v_coupon
  from public.coupons co
  join public.content_items ci on ci.id = co.content_item_id
  join public.page_items pi     on pi.content_item_id = ci.id
  join public.pages p           on p.id = pi.page_id
  join public.page_shares s     on s.page_id = p.id
  where co.id = p_coupon_id
    and s.token_hash = p_token_hash
    and s.enabled = true
    and (s.expires_at is null or s.expires_at > now())
    and p.status = 'published'
  limit 1;

  if v_coupon.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_coupon.redeemed_at is not null then
    return jsonb_build_object('ok', true, 'redeemed_at', v_coupon.redeemed_at, 'already', true);
  end if;

  update public.coupons set redeemed_at = now() where id = p_coupon_id
  returning redeemed_at into v_coupon.redeemed_at;

  return jsonb_build_object('ok', true, 'redeemed_at', v_coupon.redeemed_at, 'already', false);
end;
$$;

revoke all on function public.resolve_shared_page(text) from public;
revoke all on function public.redeem_coupon(uuid, text) from public;
grant execute on function public.resolve_shared_page(text) to anon, authenticated;
grant execute on function public.redeem_coupon(uuid, text)  to anon, authenticated;

-- ===========================================================================
-- Storage buckets
-- ===========================================================================
insert into storage.buckets (id, name, public)
values
  ('user-media', 'user-media', false),
  ('generated-previews', 'generated-previews', false),
  ('app-assets', 'app-assets', true)
on conflict (id) do nothing;

-- Owners can manage objects stored under a top-level folder named after their user id:
--   user-media/<auth.uid()>/<content_item_id>/<filename>
drop policy if exists "user-media: owner read" on storage.objects;
create policy "user-media: owner read" on storage.objects
  for select using (
    bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "user-media: owner insert" on storage.objects;
create policy "user-media: owner insert" on storage.objects
  for insert with check (
    bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "user-media: owner update" on storage.objects;
create policy "user-media: owner update" on storage.objects
  for update using (
    bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "user-media: owner delete" on storage.objects;
create policy "user-media: owner delete" on storage.objects
  for delete using (
    bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "previews: owner all" on storage.objects;
create policy "previews: owner all" on storage.objects
  for all using (
    bucket_id = 'generated-previews' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'generated-previews' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "app-assets: public read" on storage.objects;
create policy "app-assets: public read" on storage.objects
  for select using (bucket_id = 'app-assets');
