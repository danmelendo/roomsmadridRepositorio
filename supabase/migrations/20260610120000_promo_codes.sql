-- ─────────────────────────────────────────────────────────────────────────────
-- Promotional codes
--
-- Admin-managed discount codes that apply ONLY to the room price (extras are
-- always excluded). A code can discount either a percentage or a fixed amount,
-- has an optional validity window, may be single-use, and is archived (kept in
-- the DB for history but excluded from the active pool) once expired or spent.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.promo_codes (
  id             uuid primary key default gen_random_uuid(),
  code           text not null,
  discount_type  text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  valid_from     timestamptz not null default now(),
  valid_until    timestamptz,                       -- null = no expiry
  single_use     boolean not null default false,
  max_uses       integer,                           -- null = unlimited (ignored when single_use)
  times_used     integer not null default 0,
  active         boolean not null default true,
  archived       boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Case-insensitive uniqueness among the still-active (non-archived) codes, so an
-- old archived "RM15JUNIO" doesn't block reusing the name next year.
create unique index if not exists promo_codes_code_active_unique
  on public.promo_codes (upper(code)) where not archived;

create index if not exists promo_codes_archived_idx on public.promo_codes (archived);

-- Link a redeemed code (and the euros it discounted) to the reservation.
alter table public.reservations
  add column if not exists promo_code_id   uuid references public.promo_codes(id) on delete set null,
  add column if not exists discount_amount numeric(10,2) not null default 0;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.promo_codes enable row level security;

-- Staff (authenticated) manage codes fully. Note: the admin UI itself gates
-- create/edit to the 'admin' role; reception can read for reference.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='promo_codes' and policyname='auth_all_select') then
    create policy "auth_all_select" on public.promo_codes for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='promo_codes' and policyname='auth_all_insert') then
    create policy "auth_all_insert" on public.promo_codes for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='promo_codes' and policyname='auth_all_update') then
    create policy "auth_all_update" on public.promo_codes for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='promo_codes' and policyname='auth_all_delete') then
    create policy "auth_all_delete" on public.promo_codes for delete to authenticated using (true);
  end if;
end $$;

-- Anonymous public site never selects the table directly (that would leak every
-- code); it validates a single code through the SECURITY DEFINER RPC below.

-- ── Functions ────────────────────────────────────────────────────────────────

-- Archive every code whose validity window has elapsed. Returns how many were
-- archived. Safe to call repeatedly (idempotent).
create or replace function public.archive_expired_promo_codes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.promo_codes
     set archived = true, active = false
   where not archived
     and valid_until is not null
     and valid_until < now();
  get diagnostics n = row_count;
  return n;
end; $$;

grant execute on function public.archive_expired_promo_codes() to authenticated;

-- Validate a code typed by a customer. Returns the discount details for a single
-- usable code, or no rows when it doesn't exist / is expired / spent / inactive.
-- Lazily archives expired codes so the active pool stays clean.
create or replace function public.validate_promo_code(p_code text)
returns table (id uuid, code text, discount_type text, discount_value numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.archive_expired_promo_codes();

  return query
    select pc.id, pc.code, pc.discount_type, pc.discount_value
      from public.promo_codes pc
     where upper(pc.code) = upper(trim(p_code))
       and pc.active
       and not pc.archived
       and pc.valid_from <= now()
       and (pc.valid_until is null or pc.valid_until >= now())
       and (
         case
           when pc.single_use then pc.times_used < 1
           when pc.max_uses is not null then pc.times_used < pc.max_uses
           else true
         end
       )
     limit 1;
end; $$;

grant execute on function public.validate_promo_code(text) to anon, authenticated;

-- Mark a code as used once. Single-use (or codes that reach max_uses) are
-- deactivated and archived. Called server-side when a deposit is confirmed.
create or replace function public.redeem_promo_code(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.promo_codes
     set times_used = times_used + 1,
         active = case
                    when single_use then false
                    when max_uses is not null and times_used + 1 >= max_uses then false
                    else active
                  end,
         archived = case
                    when single_use then true
                    when max_uses is not null and times_used + 1 >= max_uses then true
                    else archived
                  end
   where id = p_id;
end; $$;

grant execute on function public.redeem_promo_code(uuid) to authenticated, service_role;
