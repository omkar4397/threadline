-- Supabase grants EXECUTE on new public functions to anon and authenticated by
-- default. Only anonymous visitors (the first-run setup screen) need
-- create_owner_account, and nobody needs the trigger helpers via the API.

revoke execute on function public.create_owner_account(text, text) from authenticated, service_role;
revoke execute on function public.prevent_additional_users() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.seed_default_stages(uuid) from anon, authenticated;
