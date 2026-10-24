-- Default stage templates, seeded for every new account (and backfilled for
-- any account that already exists).

create or replace function public.seed_default_stages(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.stage_templates where user_id = p_user_id) then
    return;
  end if;

  insert into public.stage_templates (user_id, name, sort_order, default_lead_days)
  values
    (p_user_id, 'Research', 1, 5),
    (p_user_id, 'Client requirement gathering', 2, 3),
    (p_user_id, 'Designs/patterns from designer', 3, 10),
    (p_user_id, 'Buying fabric from vendor', 4, 7),
    (p_user_id, 'Sampling on fabric', 5, 7),
    (p_user_id, 'Fabric printing / manufacturing', 6, 14),
    (p_user_id, 'Reviewing printed fabric', 7, 3),
    (p_user_id, 'Shipping to client', 8, 5);
end;
$$;

revoke execute on function public.seed_default_stages(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_stages(new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing accounts
select public.seed_default_stages(id) from auth.users;
