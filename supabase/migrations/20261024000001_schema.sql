-- Threadline core schema.
-- Every table carries user_id (defaulting to the signed-in user) so that RLS
-- can restrict all rows to their owner.

create type public.project_status as enum ('active', 'on_hold', 'completed');
create type public.task_status as enum ('not_started', 'in_progress', 'done');
create type public.vendor_type as enum ('fabric_supplier', 'printer', 'manufacturer', 'shipper', 'other');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Clients --------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  contact_person text,
  email text,
  phone text,
  address text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_user_id_idx on public.clients (user_id);

-- Projects -------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  delivery_date date not null,
  status public.project_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_id_idx on public.projects (user_id);
create index projects_client_id_idx on public.projects (client_id);

-- Stage templates --------------------------------------------------------------
create table public.stage_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null,
  default_lead_days integer not null check (default_lead_days between 1 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stage_templates_user_id_idx on public.stage_templates (user_id, sort_order);

-- Vendors --------------------------------------------------------------------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  type public.vendor_type not null default 'other',
  contact_person text,
  phone text,
  email text,
  location text,
  specialty text,
  typical_lead_days integer check (typical_lead_days between 1 and 365),
  minimum_order text,
  payment_terms text,
  rating smallint check (rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vendors_user_id_idx on public.vendors (user_id);

-- Designers ------------------------------------------------------------------
create table public.designers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  contact_person text,
  phone text,
  email text,
  specialty text,
  typical_lead_days integer check (typical_lead_days between 1 and 365),
  rate text,
  rating smallint check (rating between 1 and 5),
  notes text,
  portfolio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index designers_user_id_idx on public.designers (user_id);

-- Tasks ----------------------------------------------------------------------
-- Tasks copy the stage name and order from the template at creation time, so
-- renaming a stage in Settings does not rewrite existing projects.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  stage_name text not null,
  sort_order integer not null,
  start_date date not null,
  end_date date not null,
  status public.task_status not null default 'not_started',
  vendor_id uuid references public.vendors (id) on delete set null,
  designer_id uuid references public.designers (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_dates_ordered check (end_date >= start_date)
);
create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_project_id_idx on public.tasks (project_id, sort_order);
create index tasks_vendor_id_idx on public.tasks (vendor_id);
create index tasks_designer_id_idx on public.tasks (designer_id);

-- updated_at triggers ----------------------------------------------------------
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger stage_templates_updated_at before update on public.stage_templates
  for each row execute function public.set_updated_at();
create trigger vendors_updated_at before update on public.vendors
  for each row execute function public.set_updated_at();
create trigger designers_updated_at before update on public.designers
  for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
