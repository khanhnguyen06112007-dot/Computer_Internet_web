-- Run once in Supabase SQL Editor to add the Danh account to an existing project.
alter table public.quiz_players
  drop constraint if exists quiz_players_username_check;

alter table public.quiz_players
  add constraint quiz_players_username_check
  check (username in ('NguyenVanKhanh', 'NgoAnhNguyen', 'HuynhTanDuc', 'Danh'));

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

grant execute on function public.add_quiz_score(text, uuid, integer) to service_role;

insert into public.quiz_players(username) values ('Danh')
on conflict (username) do nothing;
