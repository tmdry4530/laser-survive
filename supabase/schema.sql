create table if not exists public.scores (
  id bigint generated always as identity primary key,
  player_name text not null,
  mode text not null check (mode in ('endless', 'crazy')),
  survival_time double precision not null check (survival_time >= 0 and survival_time <= 7200),
  created_at timestamptz not null default now(),
  client_version text,
  is_test_mode boolean not null default false
);

create index if not exists idx_scores_mode_rank
  on public.scores (mode, survival_time desc, created_at asc);

create index if not exists idx_scores_player_best
  on public.scores (player_name, mode, survival_time desc);

alter table public.scores enable row level security;

drop policy if exists "public can read leaderboard scores" on public.scores;
create policy "public can read leaderboard scores"
on public.scores
for select
to anon, authenticated
using (is_test_mode = false);

drop policy if exists "public can insert validated scores" on public.scores;
create policy "public can insert validated scores"
on public.scores
for insert
to anon, authenticated
with check (
  player_name ~ '^[A-Za-z0-9 _-]{1,12}$'
  and mode in ('endless', 'crazy')
  and survival_time >= 0
  and survival_time <= 7200
  and is_test_mode = false
);

create or replace function public.submit_score(
  p_player_name text,
  p_mode text,
  p_survival_time double precision,
  p_is_test_mode boolean default false,
  p_client_version text default null
)
returns table(rank bigint, is_personal_best boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_at timestamptz := now();
  v_previous_best double precision := 0;
begin
  if p_is_test_mode then
    raise exception 'Test mode scores are not accepted';
  end if;

  if p_player_name !~ '^[A-Za-z0-9 _-]{1,12}$' then
    raise exception 'Invalid player name';
  end if;

  if p_mode not in ('endless', 'crazy') then
    raise exception 'Invalid mode';
  end if;

  if p_survival_time is null or p_survival_time < 0 or p_survival_time > 7200 then
    raise exception 'Invalid survival time';
  end if;

  select coalesce(max(survival_time), 0)
    into v_previous_best
    from public.scores
   where player_name = p_player_name
     and mode = p_mode
     and is_test_mode = false;

  insert into public.scores (player_name, mode, survival_time, created_at, client_version, is_test_mode)
  values (p_player_name, p_mode, p_survival_time, v_created_at, p_client_version, false);

  return query
  select
    count(*) + 1 as rank,
    (p_survival_time > v_previous_best) as is_personal_best
  from public.scores
  where mode = p_mode
    and is_test_mode = false
    and (
      survival_time > p_survival_time
      or (survival_time = p_survival_time and created_at < v_created_at)
    );
end;
$$;

grant execute on function public.submit_score(text, text, double precision, boolean, text) to anon, authenticated;

create or replace function public.player_best(p_player_name text)
returns table(endless double precision, crazy double precision)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(max(case when mode = 'endless' and is_test_mode = false then survival_time end), 0) as endless,
    coalesce(max(case when mode = 'crazy' and is_test_mode = false then survival_time end), 0) as crazy
  from public.scores
  where player_name = p_player_name;
$$;

grant execute on function public.player_best(text) to anon, authenticated;
