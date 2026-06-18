-- =============================================================================
-- Job programado (pg_cron) para BORRAR TODAS las reservas.
--
-- Disparo: domingo 21-jun-2026 a las 00:00 hora de Madrid (CEST = UTC+2),
--          es decir 22:00 UTC del sabado 20-jun-2026  ->  cron "0 22 20 6 *".
--
-- Es un job de UN SOLO USO: la funcion se auto-desprograma tras ejecutarse,
-- de modo que no vuelve a dispararse en futuros 20-jun.
--
-- ADVERTENCIA: borra TODA la tabla reservations sin excepcion (incluidas las
-- pagadas/confirmadas). reservation_extras se borra por ON DELETE CASCADE.
--
-- Para CANCELARLO antes del domingo:
--     select cron.unschedule('purge-all-reservations-2026-06-21');
-- =============================================================================

-- 1. Asegurar pg_cron disponible (en Supabase puede requerir activarse tambien
--    desde Dashboard > Database > Extensions si este CREATE no tiene permisos).
create extension if not exists pg_cron;

-- 2. Funcion de borrado de un solo uso: borra todo y se desprograma a si misma.
create or replace function public.purge_all_reservations_oneshot()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Borra todas las reservas; reservation_extras cae por cascade.
  delete from public.reservations;

  raise notice 'purge_all_reservations_oneshot: todas las reservas borradas';

  -- Desprogramar el job para que no se repita.
  perform cron.unschedule('purge-all-reservations-2026-06-21');
end;
$$;

-- 3. Programar el disparo unico.
--    Si ya existiera un job con ese nombre, lo quitamos primero (idempotente).
do $$
begin
  perform cron.unschedule('purge-all-reservations-2026-06-21');
exception
  when others then null; -- no existia, ignorar
end $$;

select cron.schedule(
  'purge-all-reservations-2026-06-21',  -- nombre del job
  '0 22 20 6 *',                        -- 22:00 UTC sab 20-jun = 00:00 Madrid dom 21-jun
  $$ select public.purge_all_reservations_oneshot(); $$
);
