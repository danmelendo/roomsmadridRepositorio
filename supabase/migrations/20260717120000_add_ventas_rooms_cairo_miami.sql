-- ═══════════════════════════════════════════════════════════════════════════
-- Alta de 2 habitaciones nuevas en RM Ventas: "El Cairo" y "Miami".
--
-- Petición del cliente: mismos precios que Empire / Music, PERO con tarifas
-- INDEPENDIENTES (un rate_group propio por sala, con sus propias filas) para
-- poder editarlas por separado sin afectar a Empire/Music ni entre ellas.
--
-- Se dan de alta con active = false: aparecen en la AGENDA / calendario y en el
-- panel de habitaciones del personal, pero NO en la web pública (reservar.tsx
-- filtra por active = true). Cuando estén listas y con fotos, el personal las
-- activa desde el panel de Habitaciones y se completa el frontend público
-- (slugs en src/lib/roomSlugs.ts + fotos/descripciones/flags en reservar.tsx).
--
-- Idempotente: seguro de ejecutar varias veces. Los ON CONFLICT DO NOTHING de
-- las tarifas preservan cualquier edición manual posterior si se re-ejecuta.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── 1) Grupos de tarifa independientes (uno por sala) ───────────────────────
insert into rate_groups (name)
values ('El Cairo'), ('Miami')
on conflict (name) do nothing;

-- ─── 2) Tarifas por horas: copia de Music/Empire a filas propias por sala ────
-- Copia los precios actuales del grupo compartido a los grupos nuevos. Filas
-- independientes: editarlas después no toca a Music/Empire.
insert into rate_hourly (rate_group_id, duration_min, price_with_jacuzzi, price_without_jacuzzi)
select g.id, h.duration_min, h.price_with_jacuzzi, h.price_without_jacuzzi
from rate_hourly h
cross join rate_groups g
where h.rate_group_id = (select id from rate_groups where name = 'Music/Empire/Paris/Space/Ocean')
  and g.name in ('El Cairo', 'Miami')
on conflict (rate_group_id, duration_min) do nothing;

-- ─── 3) Tarifas de noche completa: misma copia independiente ─────────────────
insert into rate_overnight (rate_group_id, checkout_time, price)
select g.id, o.checkout_time, o.price
from rate_overnight o
cross join rate_groups g
where o.rate_group_id = (select id from rate_groups where name = 'Music/Empire/Paris/Space/Ocean')
  and g.name in ('El Cairo', 'Miami')
on conflict (rate_group_id, checkout_time) do nothing;

-- ─── 4) Alta de las habitaciones en RM Ventas ────────────────────────────────
-- El string `building` se toma de las salas de Ventas ya existentes (el valor
-- mayoritario), NO se hardcodea: el panel de Habitaciones agrupa por el string
-- EXACTO de building (ver 20260601170000_fix_grey_bernabeu_building.sql), así
-- que copiarlo evita que aparezcan en un grupo aparte por diferencias de
-- mayúsculas/acentos.
--
-- jacuzzi = 'always'  -> igual que el resto de Ventas (Music/Empire incluidas).
-- allows_overnight = true -> admiten noche completa (tienen tarifa overnight).
-- active = false -> visibles solo internamente hasta que el personal las active.
-- sort_order 16/17 -> a continuación de las de Ventas (Grey = 15).
with venta as (
  select building as b
  from rooms
  where lower(building) like '%venta%'
  group by building
  order by count(*) desc
  limit 1
)
insert into rooms (building, name, jacuzzi, capacity, rate_group_id, allows_overnight, active, sort_order)
select v.b, x.name, 'always'::jacuzzi_option, 2,
       (select id from rate_groups where name = x.rate_group_name),
       true, false, x.sort_order
from venta v
cross join (values
  -- name        , rate_group_name, sort_order
  ('El Cairo', 'El Cairo', 16),
  ('Miami',    'Miami',    17)
) as x(name, rate_group_name, sort_order)
on conflict (building, name) do nothing;

-- Salvaguarda: si las filas ya existían sin rate_group, engancharlo ahora.
update rooms set rate_group_id = (select id from rate_groups where name = 'El Cairo')
where lower(building) like '%venta%' and lower(name) = 'el cairo' and rate_group_id is null;

update rooms set rate_group_id = (select id from rate_groups where name = 'Miami')
where lower(building) like '%venta%' and lower(name) = 'miami' and rate_group_id is null;

commit;
