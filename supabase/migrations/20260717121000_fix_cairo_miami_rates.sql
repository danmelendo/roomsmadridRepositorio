-- ═══════════════════════════════════════════════════════════════════════════
-- FIX de 20260717120000_add_ventas_rooms_cairo_miami.sql
--
-- Aquella migración copiaba las tarifas desde el grupo llamado
-- 'Music/Empire/Paris/Space/Ocean' (nombre que figura en las migraciones del
-- repo). Pero en PRODUCCIÓN ese grupo se renombró/dividió a mano en la BD a
-- 'Music/Empire' (+ 'Paris/Space/Ocean'), así que el SELECT por nombre devolvió
-- NULL y NO se copió ninguna fila: El Cairo y Miami quedaron sin tarifas.
--
-- Aquí la copia es DATA-DRIVEN: se toma el rate_group que realmente usan las
-- salas Music / Empire State de Ventas, sea cual sea su nombre actual. Así
-- funciona aunque el grupo se haya vuelto a renombrar.
--
-- Idempotente: on conflict do nothing (no duplica ni pisa ediciones manuales).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- Tarifas por horas: copia a filas independientes de El Cairo y Miami.
with src as (
  select rate_group_id as id
  from rooms
  where lower(building) like '%venta%'
    and lower(name) in ('music', 'empire state', 'empire')
    and rate_group_id is not null
  order by lower(name)
  limit 1
),
dst as (
  select id from rate_groups where name in ('El Cairo', 'Miami')
)
insert into rate_hourly (rate_group_id, duration_min, price_with_jacuzzi, price_without_jacuzzi)
select d.id, h.duration_min, h.price_with_jacuzzi, h.price_without_jacuzzi
from rate_hourly h
cross join dst d
where h.rate_group_id = (select id from src)
on conflict (rate_group_id, duration_min) do nothing;

-- Tarifas de noche completa: misma copia independiente.
with src as (
  select rate_group_id as id
  from rooms
  where lower(building) like '%venta%'
    and lower(name) in ('music', 'empire state', 'empire')
    and rate_group_id is not null
  order by lower(name)
  limit 1
),
dst as (
  select id from rate_groups where name in ('El Cairo', 'Miami')
)
insert into rate_overnight (rate_group_id, checkout_time, price)
select d.id, o.checkout_time, o.price
from rate_overnight o
cross join dst d
where o.rate_group_id = (select id from src)
on conflict (rate_group_id, checkout_time) do nothing;

commit;
