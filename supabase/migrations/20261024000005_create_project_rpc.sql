-- Creates a project and its generated tasks in one transaction. Runs with the
-- caller's privileges, so all RLS policies still apply.

create or replace function public.create_project_with_tasks(
  p_client_id uuid,
  p_name text,
  p_delivery_date date,
  p_notes text,
  p_tasks jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  insert into public.projects (client_id, name, delivery_date, notes)
  values (p_client_id, p_name, p_delivery_date, nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_project_id;

  insert into public.tasks (project_id, stage_name, sort_order, start_date, end_date, vendor_id, designer_id)
  select
    v_project_id,
    t.stage_name,
    t.sort_order,
    t.start_date,
    t.end_date,
    t.vendor_id,
    t.designer_id
  from jsonb_to_recordset(p_tasks) as t(
    stage_name text, sort_order integer, start_date date, end_date date,
    vendor_id uuid, designer_id uuid
  );

  return v_project_id;
end;
$$;

revoke execute on function public.create_project_with_tasks(uuid, text, date, text, jsonb) from public, anon;
grant execute on function public.create_project_with_tasks(uuid, text, date, text, jsonb) to authenticated;
