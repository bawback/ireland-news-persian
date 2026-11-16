-- Severe-weather alerts (Met Éireann + Met Office NI). Safe to re-run.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists weather_alerts (
  key text primary key,                 -- source + source ids, e.g. "met_eireann:4+5"
  source text not null,                 -- met_eireann | met_office
  level text not null,                  -- yellow | orange | red
  types text[] not null default '{}',
  regions text[] not null default '{}', -- county codes (EI07 = Dublin) or {NI}
  areas_fa text not null,
  headline_en text not null,
  description_en text not null default '',
  title_fa text not null,
  body_fa text not null,
  onset timestamptz not null,
  expiry timestamptz not null,
  link text not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  relevant boolean not null default true,
  telegram_message_id bigint,
  telegram_text text,
  first_posted_at timestamptz,
  reminder_sent_at timestamptz,
  morning_sent_at timestamptz,          -- last 07:00 "today's warnings" post that included this alert
  closed_note_at timestamptz,           -- when the "this warning has ended" note was added in Telegram
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists weather_alerts_expiry_idx on weather_alerts (expiry desc);

alter table weather_alerts enable row level security;
drop policy if exists "public can read relevant weather alerts" on weather_alerts;
create policy "public can read relevant weather alerts" on weather_alerts for select using (relevant);
grant select on weather_alerts to anon, authenticated;
grant all on weather_alerts to service_role;

-- The hourly news pipeline (06:27–23:27 UTC) already checks the warnings every hour.
-- These extra night runs catch a warning issued overnight. Each run takes about a minute of GitHub Actions time.
select cron.schedule('weather-night', '57 0,2,4 * * *', $$
  select net.http_post(
    url := 'https://api.github.com/repos/bawback/ireland-news-persian/actions/workflows/weather.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_token'),
      'Accept', 'application/vnd.github+json',
      'User-Agent', 'supabase-cron'),
    body := '{"ref":"main"}'::jsonb);
$$);
