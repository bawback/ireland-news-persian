-- Nightly podcast episodes. Safe to re-run.
create table if not exists podcasts (
  id uuid primary key default gen_random_uuid(),
  episode_date date not null unique,
  title text not null,
  description text not null,
  script text not null,
  audio_url text not null,
  duration_sec int not null,
  size_bytes int not null,
  article_slugs text[] not null default '{}',
  telegram_message_id bigint,
  created_at timestamptz not null default now()
);
alter table podcasts enable row level security;
drop policy if exists "public can read podcasts" on podcasts;
create policy "public can read podcasts" on podcasts for select using (true);
grant select on podcasts to anon, authenticated;
grant all on podcasts to service_role;

-- Start the podcast workflow at 21:00 and 22:00 UTC; the script itself only runs at 22:xx Dublin time.
select cron.schedule('podcast-nightly', '0 21,22 * * *', $$
  select net.http_post(
    url := 'https://api.github.com/repos/bawback/ireland-news-persian/actions/workflows/podcast.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_token'),
      'Accept', 'application/vnd.github+json',
      'User-Agent', 'supabase-cron'),
    body := '{"ref":"main"}'::jsonb);
$$);
