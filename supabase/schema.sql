-- Ireland News Persian — database schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create extension if not exists pgcrypto;

-- Every item seen in an RSS feed (so nothing is processed or paid for twice)
create table if not exists raw_items (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  source_id text not null,
  title text not null,
  summary text,
  published_at timestamptz,
  status text not null default 'new', -- new | skipped | candidate | done | failed
  category text,
  importance int,
  immigrant_relevance int,
  sensitive boolean,
  story_key text,
  article_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists raw_items_story_key_idx on raw_items (story_key, created_at desc);

-- Persian articles shown on the website
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_fa text not null,
  summary_fa text not null,
  body_fa text not null,
  category text not null,
  tags text[] not null default '{}',
  immigrant_relevance int not null default 0,
  importance int not null default 1,
  mode text not null check (mode in ('translation', 'report')),
  source_id text,
  source_name text not null,
  source_url text not null,
  source_title text,
  image_url text,
  image_credit text,
  social jsonb not null default '{}',
  confidence text,
  notes_for_editor text,
  status text not null default 'pending_review' check (status in ('pending_review', 'published', 'rejected')),
  published_at timestamptz,
  telegram_message_id bigint,
  created_at timestamptz not null default now()
);
create index if not exists articles_published_idx on articles (status, published_at desc);
create index if not exists articles_category_idx on articles (category, published_at desc);

-- When an editor changes status to 'published', stamp the publish time automatically.
create or replace function set_published_at() returns trigger as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists articles_set_published_at on articles;
create trigger articles_set_published_at
  before insert or update on articles
  for each row execute function set_published_at();

-- Security: the public website may only read published articles.
alter table articles enable row level security;
alter table raw_items enable row level security;

drop policy if exists "public can read published articles" on articles;
create policy "public can read published articles" on articles
  for select using (status = 'published');
-- (No policies on raw_items: only the worker, using the service role key, can access it.)
