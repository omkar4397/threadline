-- Project expenses, with a per-user list of categories.
--
-- An expense always belongs to a project. It can optionally be linked to one
-- stage (task) of that project and paid to one vendor or one designer.
-- Deleting a stage, vendor, designer or category keeps the expense and just
-- clears that link.

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index expense_categories_user_name_key on public.expense_categories (user_id, lower(name));

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  category_id uuid references public.expense_categories (id) on delete set null,
  vendor_id uuid references public.vendors (id) on delete set null,
  designer_id uuid references public.designers (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  spent_on date not null default current_date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_single_payee check (vendor_id is null or designer_id is null)
);
create index expenses_user_id_idx on public.expenses (user_id);
create index expenses_project_id_idx on public.expenses (project_id, spent_on);
create index expenses_task_id_idx on public.expenses (task_id);
create index expenses_category_id_idx on public.expenses (category_id);
create index expenses_vendor_id_idx on public.expenses (vendor_id);
create index expenses_designer_id_idx on public.expenses (designer_id);

create trigger expense_categories_updated_at before update on public.expense_categories
  for each row execute function public.set_updated_at();
create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------------
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
revoke all on public.expense_categories, public.expenses from anon;

create policy "Owner can read expense categories" on public.expense_categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner can insert expense categories" on public.expense_categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Owner can update expense categories" on public.expense_categories
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owner can delete expense categories" on public.expense_categories
  for delete to authenticated using (user_id = (select auth.uid()));

-- Every link must point at the owner's rows, and a linked stage must belong
-- to the same project. Columns are qualified with the table name because the
-- tasks subquery has its own project_id.
create policy "Owner can read expenses" on public.expenses
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner can insert expenses" on public.expenses
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = expenses.project_id and p.user_id = (select auth.uid()))
    and (expenses.task_id is null or exists (select 1 from public.tasks t where t.id = expenses.task_id and t.project_id = expenses.project_id and t.user_id = (select auth.uid())))
    and (expenses.category_id is null or exists (select 1 from public.expense_categories c where c.id = expenses.category_id and c.user_id = (select auth.uid())))
    and (expenses.vendor_id is null or exists (select 1 from public.vendors v where v.id = expenses.vendor_id and v.user_id = (select auth.uid())))
    and (expenses.designer_id is null or exists (select 1 from public.designers d where d.id = expenses.designer_id and d.user_id = (select auth.uid())))
  );
create policy "Owner can update expenses" on public.expenses
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = expenses.project_id and p.user_id = (select auth.uid()))
    and (expenses.task_id is null or exists (select 1 from public.tasks t where t.id = expenses.task_id and t.project_id = expenses.project_id and t.user_id = (select auth.uid())))
    and (expenses.category_id is null or exists (select 1 from public.expense_categories c where c.id = expenses.category_id and c.user_id = (select auth.uid())))
    and (expenses.vendor_id is null or exists (select 1 from public.vendors v where v.id = expenses.vendor_id and v.user_id = (select auth.uid())))
    and (expenses.designer_id is null or exists (select 1 from public.designers d where d.id = expenses.designer_id and d.user_id = (select auth.uid())))
  );
create policy "Owner can delete expenses" on public.expenses
  for delete to authenticated using (user_id = (select auth.uid()));

-- Default categories, seeded for new accounts and backfilled ---------------------
create or replace function public.seed_default_expense_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.expense_categories (user_id, name, is_default)
  values
    (p_user_id, 'Fabric purchase', true),
    (p_user_id, 'Printing & manufacturing', true),
    (p_user_id, 'Sampling', true),
    (p_user_id, 'Designer fees', true),
    (p_user_id, 'Courier & shipping', true)
  on conflict do nothing;
end;
$$;

revoke execute on function public.seed_default_expense_categories(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_stages(new.id);
  perform public.seed_default_expense_categories(new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

select public.seed_default_expense_categories(id) from auth.users;
