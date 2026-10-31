-- Pricing: what the consultant quotes the client vs what the vendor agreed.
--
-- A pricing line has a quantity and unit, a vendor price per unit (always INR)
-- and a client price per unit in any currency. Foreign currencies are converted
-- with a rate locked per project, so margins stay stable as rates move.

-- Units a line can be priced in. "flat" means one fixed amount.
create type public.pricing_unit as enum ('metre', 'piece', 'design', 'shipment', 'set', 'kg', 'flat');

-- What extra detail an item type asks for: nothing, a free-text name (fabric),
-- or a product from the product list (sampling, production).
create type public.pricing_detail as enum ('none', 'text', 'product');

create table public.pricing_item_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  default_unit public.pricing_unit not null default 'piece',
  detail public.pricing_detail not null default 'none',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index pricing_item_types_user_name_key on public.pricing_item_types (user_id, lower(name));

create table public.pricing_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  default_unit public.pricing_unit not null default 'piece',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index pricing_products_user_name_key on public.pricing_products (user_id, lower(name));

create table public.pricing_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Types and products in use can't be deleted, so lines never lose their label.
  item_type_id uuid not null references public.pricing_item_types (id) on delete restrict,
  product_id uuid references public.pricing_products (id) on delete restrict,
  detail text check (detail is null or length(detail) <= 120),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit public.pricing_unit not null,
  vendor_rate numeric(14, 2) not null default 0 check (vendor_rate >= 0),
  client_rate numeric(14, 2) not null default 0 check (client_rate >= 0),
  client_currency char(3) not null default 'INR' check (client_currency ~ '^[A-Z]{3}$'),
  vendor_id uuid references public.vendors (id) on delete set null,
  designer_id uuid references public.designers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_lines_single_provider check (vendor_id is null or designer_id is null)
);
create index pricing_lines_user_id_idx on public.pricing_lines (user_id);
create index pricing_lines_project_id_idx on public.pricing_lines (project_id, created_at);
create index pricing_lines_item_type_id_idx on public.pricing_lines (item_type_id);
create index pricing_lines_product_id_idx on public.pricing_lines (product_id);
create index pricing_lines_vendor_id_idx on public.pricing_lines (vendor_id);
create index pricing_lines_designer_id_idx on public.pricing_lines (designer_id);

-- Consulting fee per project, quoted in the client's currency.
alter table public.projects
  add column consulting_fee numeric(14, 2) check (consulting_fee is null or consulting_fee >= 0),
  add column consulting_fee_currency char(3) not null default 'INR' check (consulting_fee_currency ~ '^[A-Z]{3}$');

-- Rates locked per project: INR for 1 unit of the currency.
create table public.project_fx_rates (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$' and currency <> 'INR'),
  inr_per_unit numeric(18, 8) not null check (inr_per_unit > 0),
  manual boolean not null default false,
  locked_at timestamptz not null default now(),
  primary key (project_id, currency)
);
create index project_fx_rates_user_id_idx on public.project_fx_rates (user_id);

-- The latest daily rates fetched for this account, kept so the app still
-- works (with the last saved rates) if the rate services are unreachable.
-- rates: { "USD": <INR per 1 USD>, ... }
create table public.fx_latest (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  rates jsonb not null,
  source text not null,
  fetched_at timestamptz not null default now()
);

create trigger pricing_item_types_updated_at before update on public.pricing_item_types
  for each row execute function public.set_updated_at();
create trigger pricing_products_updated_at before update on public.pricing_products
  for each row execute function public.set_updated_at();
create trigger pricing_lines_updated_at before update on public.pricing_lines
  for each row execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------------
alter table public.pricing_item_types enable row level security;
alter table public.pricing_products enable row level security;
alter table public.pricing_lines enable row level security;
alter table public.project_fx_rates enable row level security;
alter table public.fx_latest enable row level security;
revoke all on public.pricing_item_types, public.pricing_products, public.pricing_lines,
  public.project_fx_rates, public.fx_latest from anon;

create policy "Owner can read pricing item types" on public.pricing_item_types
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner can insert pricing item types" on public.pricing_item_types
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Owner can update pricing item types" on public.pricing_item_types
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owner can delete pricing item types" on public.pricing_item_types
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Owner can read pricing products" on public.pricing_products
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner can insert pricing products" on public.pricing_products
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Owner can update pricing products" on public.pricing_products
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owner can delete pricing products" on public.pricing_products
  for delete to authenticated using (user_id = (select auth.uid()));

-- Every link on a line must point at the owner's own rows.
create policy "Owner can read pricing lines" on public.pricing_lines
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner can insert pricing lines" on public.pricing_lines
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = pricing_lines.project_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.pricing_item_types t where t.id = pricing_lines.item_type_id and t.user_id = (select auth.uid()))
    and (pricing_lines.product_id is null or exists (select 1 from public.pricing_products pr where pr.id = pricing_lines.product_id and pr.user_id = (select auth.uid())))
    and (pricing_lines.vendor_id is null or exists (select 1 from public.vendors v where v.id = pricing_lines.vendor_id and v.user_id = (select auth.uid())))
    and (pricing_lines.designer_id is null or exists (select 1 from public.designers d where d.id = pricing_lines.designer_id and d.user_id = (select auth.uid())))
  );
create policy "Owner can update pricing lines" on public.pricing_lines
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = pricing_lines.project_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.pricing_item_types t where t.id = pricing_lines.item_type_id and t.user_id = (select auth.uid()))
    and (pricing_lines.product_id is null or exists (select 1 from public.pricing_products pr where pr.id = pricing_lines.product_id and pr.user_id = (select auth.uid())))
    and (pricing_lines.vendor_id is null or exists (select 1 from public.vendors v where v.id = pricing_lines.vendor_id and v.user_id = (select auth.uid())))
    and (pricing_lines.designer_id is null or exists (select 1 from public.designers d where d.id = pricing_lines.designer_id and d.user_id = (select auth.uid())))
  );
create policy "Owner can delete pricing lines" on public.pricing_lines
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Owner can read project rates" on public.project_fx_rates
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner can insert project rates" on public.project_fx_rates
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_fx_rates.project_id and p.user_id = (select auth.uid()))
  );
create policy "Owner can update project rates" on public.project_fx_rates
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_fx_rates.project_id and p.user_id = (select auth.uid()))
  );
create policy "Owner can delete project rates" on public.project_fx_rates
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Owner can read latest rates" on public.fx_latest
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner can insert latest rates" on public.fx_latest
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Owner can update latest rates" on public.fx_latest
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Defaults, seeded for new accounts and backfilled -------------------------------
create or replace function public.seed_default_pricing_lists(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pricing_item_types (user_id, name, default_unit, detail, sort_order)
  values
    (p_user_id, 'Fabric cost', 'metre', 'text', 1),
    (p_user_id, 'Designing', 'design', 'none', 2),
    (p_user_id, 'Sampling', 'piece', 'product', 3),
    (p_user_id, 'Production', 'piece', 'product', 4),
    (p_user_id, 'Courier', 'shipment', 'none', 5)
  on conflict do nothing;

  insert into public.pricing_products (user_id, name, default_unit)
  values
    (p_user_id, 'Fabric printing', 'metre'),
    (p_user_id, 'Cap', 'piece'),
    (p_user_id, 'Jacket', 'piece'),
    (p_user_id, 'Bag', 'piece'),
    (p_user_id, 'Tapestry', 'piece')
  on conflict do nothing;
end;
$$;

revoke execute on function public.seed_default_pricing_lists(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_stages(new.id);
  perform public.seed_default_expense_categories(new.id);
  perform public.seed_default_pricing_lists(new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

select public.seed_default_pricing_lists(id) from auth.users;
