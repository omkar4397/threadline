-- Single-user, username + password login.
--
-- Supabase Auth identifies users by email, so a username maps to the internal
-- address <username>@threadline.local. No email is ever sent to it.
--
-- create_owner_account() creates the one and only account (confirmed, so no
-- confirmation email is needed). After that, a trigger rejects any further
-- users, including sign-ups through the public Auth API.

create or replace function public.owner_exists()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users);
$$;

revoke execute on function public.owner_exists() from public;
grant execute on function public.owner_exists() to anon, authenticated;

create or replace function public.prevent_additional_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'Threadline is a single-user app and already has an owner account';
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_additional_users() from public, anon, authenticated;

create trigger enforce_single_user
  before insert on auth.users
  for each row execute function public.prevent_additional_users();

create or replace function public.create_owner_account(p_username text, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(trim(p_username));
  v_email text;
  v_user_id uuid := gen_random_uuid();
begin
  if v_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$' then
    raise exception 'Username must be 3-32 characters: letters, numbers, dot, dash or underscore';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  -- Serialise concurrent calls so only one owner can ever be created.
  lock table auth.users in share row exclusive mode;
  if exists (select 1 from auth.users) then
    raise exception 'An owner account already exists';
  end if;

  v_email := v_username || '@threadline.local';

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', v_username), now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text, 'email',
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    now(), now(), now()
  );
end;
$$;

revoke execute on function public.create_owner_account(text, text) from public;
grant execute on function public.create_owner_account(text, text) to anon;
