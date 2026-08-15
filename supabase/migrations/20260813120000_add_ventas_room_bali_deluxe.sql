-- ═══════════════════════════════════════════════════════════════════════════
-- Alta de "Bali Deluxe" en RM Ventas (sala PREMIUM).
--
-- Igual patrón que El Cairo / Miami (20260717120000/121000): rate_group PROPIO
-- con tarifas INDEPENDIENTES, copiadas en vivo de otro grupo. Aquí la fuente es
-- el grupo que usan las salas **Grey** (tramo más alto en prod: 60min=55 €,
-- 360min=150 €, noche 120/130/140 €). El cliente pidió "igual que Grey".
--
-- Specs del cliente: piscina climatizada, sillón tantra, columpio, luces led,
-- secador, baño completo con ducha hidromasaje, TV 75", toallas, barra
-- americana, mesa pequeña + 2 sillas. Decoración: SIN pantalla y SIN cubo led
-- (mensaje en el cristal / frase en la cama). De ahí:
--   has_tv = true  (TV 75")   ·   has_swing = true (columpio)
--   jacuzzi = 'always' (piscina climatizada = agua siempre incluida)
--   allows_overnight = true    ·   NO va en ROOMS_WITH_SCREEN ni _LED_CUBE (front)
--
-- active = false: visible solo en la agenda/panel interno, NO en la web pública
-- (reservar.tsx filtra active=true). Activar cuando lleguen las fotos.
--
-- Copia DATA-DRIVEN por la sala (no por nombre de grupo): en prod los grupos se
-- renombraron a mano y el nombre puede volver a cambiar (ver 20260717121000).
-- Idempotente: on conflict do nothing (no duplica ni pisa ediciones manuales).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- 1) Grupo de tarifa independiente.
insert into rate_groups (name) values ('Bali Deluxe')
on conflict (name) do nothing;

-- 2) Tarifas por horas: copia del grupo de las salas Grey a filas propias.
with src as (
  select rate_group_id as id
  from rooms
  where lower(name) = 'grey' and rate_group_id is not null
  limit 1
),
dst as (select id from rate_groups where name = 'Bali Deluxe')
insert into rate_hourly (rate_group_id, duration_min, price_with_jacuzzi, price_without_jacuzzi)
select d.id, h.duration_min, h.price_with_jacuzzi, h.price_without_jacuzzi
from rate_hourly h
cross join dst d
where h.rate_group_id = (select id from src)
on conflict (rate_group_id, duration_min) do nothing;

-- 3) Noche completa: misma copia independiente.
with src as (
  select rate_group_id as id
  from rooms
  where lower(name) = 'grey' and rate_group_id is not null
  limit 1
),
dst as (select id from rate_groups where name = 'Bali Deluxe')
insert into rate_overnight (rate_group_id, checkout_time, price)
select d.id, o.checkout_time, o.price
from rate_overnight o
cross join dst d
where o.rate_group_id = (select id from src)
on conflict (rate_group_id, checkout_time) do nothing;

-- 4) Alta de la habitación (building data-driven; active=false).
with venta as (
  select building as b
  from rooms
  where lower(building) like '%venta%'
  group by building
  order by count(*) desc
  limit 1
)
insert into rooms (building, name, jacuzzi, capacity, rate_group_id, has_tv, has_swing, allows_overnight, active, sort_order)
select v.b, 'Bali Deluxe', 'always'::jacuzzi_option, 2,
       (select id from rate_groups where name = 'Bali Deluxe'),
       true, true, true, false, 18
from venta v
on conflict (building, name) do nothing;

-- Salvaguarda: si la fila ya existía sin rate_group, engancharlo ahora.
update rooms set rate_group_id = (select id from rate_groups where name = 'Bali Deluxe')
where lower(building) like '%venta%' and lower(name) = 'bali deluxe' and rate_group_id is null;

commit;
