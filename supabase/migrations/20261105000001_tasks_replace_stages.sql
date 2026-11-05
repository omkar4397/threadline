-- Replace fixed stages with free-form tasks and milestones.
--
-- A task now has its own title (picked from a reusable list or typed), its own
-- dates, and is assigned to the consultant ("me"), one vendor, one designer,
-- or nobody yet. A milestone is a single-date task. Tasks no longer have a
-- fixed order; they are ordered by date.
--
-- As agreed with the consultant, existing stage tasks are cleared.

delete from public.tasks;

alter table public.tasks rename column stage_name to title;
alter table public.tasks drop column sort_order;

create type public.task_kind as enum ('task', 'milestone');

alter table public.tasks
  add column kind public.task_kind not null default 'task',
  add column assigned_to_self boolean not null default false,
  add constraint tasks_title_present check (length(trim(title)) between 1 and 120),
  add constraint tasks_milestone_single_day check (kind = 'task' or start_date = end_date),
  add constraint tasks_single_assignee check (num_nonnulls(vendor_id, designer_id, nullif(assigned_to_self, false)) <= 1);

create index tasks_project_dates_idx on public.tasks (project_id, start_date, end_date);

-- Stage templates become a plain list of quick-pick task names.
alter table public.stage_templates rename to task_names;
alter table public.task_names drop column default_lead_days;
alter index public.stage_templates_user_id_idx rename to task_names_user_id_idx;
alter trigger stage_templates_updated_at on public.task_names rename to task_names_updated_at;
alter policy "Owner can read stage templates" on public.task_names rename to "Owner can read task names";
alter policy "Owner can insert stage templates" on public.task_names rename to "Owner can insert task names";
alter policy "Owner can update stage templates" on public.task_names rename to "Owner can update task names";
alter policy "Owner can delete stage templates" on public.task_names rename to "Owner can delete task names";

create or replace function public.seed_default_stages(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.task_names where user_id = p_user_id) then
    return;
  end if;

  insert into public.task_names (user_id, name, sort_order)
  values
    (p_user_id, 'Research', 1),
    (p_user_id, 'Client requirement gathering', 2),
    (p_user_id, 'Designs/patterns from designer', 3),
    (p_user_id, 'Buying fabric from vendor', 4),
    (p_user_id, 'Sampling on fabric', 5),
    (p_user_id, 'Fabric printing / manufacturing', 6),
    (p_user_id, 'Reviewing printed fabric', 7),
    (p_user_id, 'Shipping to client', 8);
end;
$$;

revoke execute on function public.seed_default_stages(uuid) from public, anon, authenticated;

-- Projects are now created without generated tasks.
drop function public.create_project_with_tasks(uuid, text, date, text, jsonb);
