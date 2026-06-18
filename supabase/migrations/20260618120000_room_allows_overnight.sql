-- Per-room overnight control + fix missing overnight rates.
--
-- Background: overnight availability was driven purely by (a) day of week and
-- (b) whether the room's rate_group had a rate_overnight row. There was no way
-- to disable overnight for a single room whose rate group is shared across
-- buildings (e.g. "Grey" is shared by Ventas/America/Bernabeu), and several rate
-- groups were missing their overnight row entirely, which made the app price an
-- overnight stay at 0 EUR or throw "Tarifa de noche completa no configurada".
--
-- This migration:
--   1) Adds rooms.allows_overnight (admin-controlled, default true).
--   2) Disables overnight for the Grey room of RM Ventas (hourly only).
--   3) Ensures Hollywood, Maldivas and Tokyo rate groups have an overnight rate.
--
-- Idempotent: safe to run multiple times.

begin;

-- 1) Per-room overnight flag (admin toggle in the Rooms page).
alter table rooms
  add column if not exists allows_overnight boolean not null default true;

-- 2) Grey · RM Ventas -> hourly only.
update rooms
set allows_overnight = false
where lower(building) like 'venta%'
  and lower(name) = 'grey';

-- 3) Ensure overnight (10:00 checkout) exists for the rate groups that were
--    missing it. 110 EUR matches the intent of the earlier fix migrations and
--    the price used by the other budget rate groups.
with
  g as (
    select id, name
    from rate_groups
    where lower(name) like 'hollywood%'
       or lower(name) like 'maldivas%'
       or lower(name) like 'tokyo%'
  ),
  overnight(checkout_time, price) as (
    values ('10:00:00'::time, 110)
  )
insert into rate_overnight (rate_group_id, checkout_time, price)
select g.id, o.checkout_time, o.price
from g
cross join overnight o
on conflict (rate_group_id, checkout_time)
do update set price = excluded.price;

commit;
