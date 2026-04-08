create extension if not exists pgcrypto;

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
  player_name ~ '^[가-힣A-Za-z0-9 _-]{1,12}$'
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

  if p_player_name !~ '^[가-힣A-Za-z0-9 _-]{1,12}$' then
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

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('endless', 'crazy')),
  name text not null,
  description text not null,
  storage_path text not null unique,
  required_time double precision not null check (required_time > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards(id) on delete cascade,
  mode text not null check (mode in ('endless', 'crazy')),
  device_id_hash text not null,
  player_name text not null,
  survival_time double precision not null,
  claimed_at timestamptz not null default now(),
  unique (reward_id),
  unique (mode, device_id_hash)
);

create index if not exists idx_reward_claims_mode_device
  on public.reward_claims (mode, device_id_hash);

create index if not exists idx_rewards_mode_active
  on public.rewards (mode, active);

create unique index if not exists idx_rewards_storage_path_unique
  on public.rewards (storage_path);

create unique index if not exists idx_reward_claims_reward_id_unique
  on public.reward_claims (reward_id);

alter table public.rewards
  drop constraint if exists rewards_mode_key;

alter table public.rewards enable row level security;
alter table public.reward_claims enable row level security;

drop policy if exists "public can read active rewards metadata" on public.rewards;
create policy "public can read active rewards metadata"
on public.rewards
for select
to anon, authenticated
using (active = true);

drop policy if exists "no direct claim table reads" on public.reward_claims;
create policy "no direct claim table reads"
on public.reward_claims
for select
to anon, authenticated
using (false);

create or replace function public.claim_reward(
  p_mode text,
  p_device_id_hash text,
  p_player_name text,
  p_survival_time double precision
)
returns table(
  status text,
  reward_id uuid,
  reward_name text,
  reward_description text,
  required_time double precision
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.rewards%rowtype;
  v_existing public.reward_claims%rowtype;
  v_claimed_reward public.rewards%rowtype;
begin
  if p_mode not in ('endless', 'crazy') then
    raise exception 'Invalid mode';
  end if;

  if p_player_name !~ '^[가-힣A-Za-z0-9 _-]{1,12}$' then
    raise exception 'Invalid player name';
  end if;

  if p_device_id_hash is null or length(p_device_id_hash) < 16 then
    raise exception 'Invalid device id hash';
  end if;

  select *
    into v_existing
    from public.reward_claims
   where mode = p_mode
     and device_id_hash = p_device_id_hash
   limit 1;

  if found then
    select *
      into v_claimed_reward
      from public.rewards
     where id = v_existing.reward_id
     limit 1;

    return query select 'already_claimed', v_claimed_reward.id, v_claimed_reward.name, v_claimed_reward.description, v_claimed_reward.required_time;
    return;
  end if;

  select *
    into v_reward
    from public.rewards rewards
   where rewards.mode = p_mode
     and rewards.active = true
     and not exists (
       select 1
         from public.reward_claims claims
        where claims.reward_id = rewards.id
     )
   order by random()
   limit 1;

  if not found then
    return query select 'sold_out', null::uuid, null::text, null::text, 0::double precision;
    return;
  end if;

  if p_survival_time < v_reward.required_time then
    return query select 'not_eligible', v_reward.id, v_reward.name, v_reward.description, v_reward.required_time;
    return;
  end if;

  insert into public.reward_claims (reward_id, mode, device_id_hash, player_name, survival_time)
  values (v_reward.id, p_mode, p_device_id_hash, p_player_name, p_survival_time);

  return query select 'claimed', v_reward.id, v_reward.name, v_reward.description, v_reward.required_time;
end;
$$;

grant execute on function public.claim_reward(text, text, text, double precision) to service_role;

update public.rewards
set active = false
where mode = 'endless'
  and storage_path = 'endless/reward.png';

insert into public.rewards (mode, name, description, storage_path, required_time)
values
    ('endless', 'Endless Survivor Reward 01', 'Survive 180 seconds in Endless mode.', 'endless/reward-01.png', 180),
    ('endless', 'Endless Survivor Reward 02', 'Survive 180 seconds in Endless mode.', 'endless/reward-02.png', 180),
    ('endless', 'Endless Survivor Reward 03', 'Survive 180 seconds in Endless mode.', 'endless/reward-03.png', 180),
    ('endless', 'Endless Survivor Reward 04', 'Survive 180 seconds in Endless mode.', 'endless/reward-04.png', 180),
    ('endless', 'Endless Survivor Reward 05', 'Survive 180 seconds in Endless mode.', 'endless/reward-05.png', 180),
    ('endless', 'Endless Survivor Reward 06', 'Survive 180 seconds in Endless mode.', 'endless/reward-06.png', 180),
    ('endless', 'Endless Survivor Reward 07', 'Survive 180 seconds in Endless mode.', 'endless/reward-07.png', 180),
    ('endless', 'Endless Survivor Reward 08', 'Survive 180 seconds in Endless mode.', 'endless/reward-08.png', 180),
    ('endless', 'Endless Survivor Reward 09', 'Survive 180 seconds in Endless mode.', 'endless/reward-09.png', 180),
    ('endless', 'Endless Survivor Reward 10', 'Survive 180 seconds in Endless mode.', 'endless/reward-10.png', 180),
    ('endless', 'Endless Survivor Reward 11', 'Survive 180 seconds in Endless mode.', 'endless/reward-11.png', 180),
    ('endless', 'Endless Survivor Reward 12', 'Survive 180 seconds in Endless mode.', 'endless/reward-12.png', 180),
    ('crazy', 'Crazy Survivor Reward', 'Survive 90 seconds in Crazy mode.', 'crazy/reward.png', 90)
on conflict (storage_path) do update
set
  name = excluded.name,
  description = excluded.description,
  required_time = excluded.required_time,
  mode = excluded.mode,
  active = true;
