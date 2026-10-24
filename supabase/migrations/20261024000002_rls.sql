-- Row Level Security: only the signed-in owner can read or write their rows.
-- Foreign keys are additionally checked on write so a row can never point at
-- another user's client, project, vendor or designer.

alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.stage_templates enable row level security;
alter table public.vendors enable row level security;
alter table public.designers enable row level security;
alter table public.tasks enable row level security;

revoke all on public.clients, public.projects, public.stage_templates,
  public.vendors, public.designers, public.tasks from anon;

-- Simple owner-only tables
create policy "Owner can read clients" on public.clients
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner can insert clients" on public.clients
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Owner can update clients" on public.clients
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owner can delete clients" on public.clients
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Owner can read stage templates" on public.stage_templates
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner can insert stage templates" on public.stage_templates
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Owner can update stage templates" on public.stage_templates
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owner can delete stage templates" on public.stage_templates
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Owner can read vendors" on public.vendors
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner can insert vendors" on public.vendors
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Owner can update vendors" on public.vendors
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owner can delete vendors" on public.vendors
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Owner can read designers" on public.designers
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner can insert designers" on public.designers
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Owner can update designers" on public.designers
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owner can delete designers" on public.designers
  for delete to authenticated using (user_id = (select auth.uid()));

-- Projects must reference one of the owner's clients
create policy "Owner can read projects" on public.projects
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner can insert projects" on public.projects
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.clients c where c.id = client_id and c.user_id = (select auth.uid()))
  );
create policy "Owner can update projects" on public.projects
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.clients c where c.id = client_id and c.user_id = (select auth.uid()))
  );
create policy "Owner can delete projects" on public.projects
  for delete to authenticated using (user_id = (select auth.uid()));

-- Tasks must reference the owner's project, vendor and designer
create policy "Owner can read tasks" on public.tasks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner can insert tasks" on public.tasks
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))
    and (vendor_id is null or exists (select 1 from public.vendors v where v.id = vendor_id and v.user_id = (select auth.uid())))
    and (designer_id is null or exists (select 1 from public.designers d where d.id = designer_id and d.user_id = (select auth.uid())))
  );
create policy "Owner can update tasks" on public.tasks
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))
    and (vendor_id is null or exists (select 1 from public.vendors v where v.id = vendor_id and v.user_id = (select auth.uid())))
    and (designer_id is null or exists (select 1 from public.designers d where d.id = designer_id and d.user_id = (select auth.uid())))
  );
create policy "Owner can delete tasks" on public.tasks
  for delete to authenticated using (user_id = (select auth.uid()));
