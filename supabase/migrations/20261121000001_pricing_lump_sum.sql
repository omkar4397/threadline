-- Pricing lines can be priced per unit (rate × quantity) or as a lump sum,
-- where vendor_rate and client_rate hold the totals for the whole quantity
-- (e.g. 3 designs for one agreed amount).

create type public.pricing_basis as enum ('unit', 'total');

alter table public.pricing_lines
  add column price_basis public.pricing_basis not null default 'unit';
