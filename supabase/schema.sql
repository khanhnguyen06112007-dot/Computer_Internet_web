-- Run this once in Supabase Dashboard > SQL Editor.
create table if not exists public.quiz_players (
  username text primary key check (username in ('NguyenVanKhanh', 'NgoAnhNguyen', 'HuynhTanDuc', 'Danh')),
  total_points integer not null default 0 check (total_points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_submissions (
  username text not null references public.quiz_players(username) on delete cascade,
  submission_id uuid not null,
  correct_answers integer not null check (correct_answers between 0 and 70),
  submitted_at timestamptz not null default now(),
  primary key (username, submission_id)
);

alter table public.quiz_players enable row level security;
alter table public.quiz_submissions enable row level security;
revoke all on public.quiz_players from anon, authenticated;
revoke all on public.quiz_submissions from anon, authenticated;
grant select, insert, update on public.quiz_players to service_role;
grant select, insert on public.quiz_submissions to service_role;

create or replace function public.add_quiz_score(
  p_username text,
  p_submission_id uuid,
  p_points integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_username not in ('NguyenVanKhanh', 'NgoAnhNguyen', 'HuynhTanDuc', 'Danh')
     or p_points < 0 or p_points > 70 then
    raise exception 'Invalid score submission';
  end if;

  insert into public.quiz_players(username) values (p_username)
  on conflict (username) do nothing;

  insert into public.quiz_submissions(username, submission_id, correct_answers)
  values (p_username, p_submission_id, p_points)
  on conflict (username, submission_id) do nothing;
  if not found then
    return false;
  end if;

  update public.quiz_players
  set total_points = total_points + p_points, updated_at = now()
  where username = p_username;
  return true;
end;
$$;

revoke all on function public.add_quiz_score(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.add_quiz_score(text, uuid, integer) to service_role;

insert into public.quiz_players(username) values
  ('NguyenVanKhanh'), ('NgoAnhNguyen'), ('HuynhTanDuc'), ('Danh')
on conflict (username) do nothing;
