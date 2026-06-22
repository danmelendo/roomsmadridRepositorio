-- =============================================================================
-- (NEUTRALIZADO el 22-jun-2026)
--
-- Esta migración PROGRAMABA un job pg_cron que BORRABA TODAS las reservas
-- (incluidas las pagadas/confirmadas) el 21-jun-2026 a las 00:00 Madrid, y se
-- repetía cada 20-jun. Nunca llegó a aplicarse en remoto, pero quedaba como un
-- "landmine": cualquier `supabase db push` futuro lo habría programado.
--
-- Se ha dejado INERTE para evitar pérdida de datos accidental. Ya NO programa
-- nada. Se conserva una función de borrado MANUAL (no automática); para purgar
-- las reservas hay que ejecutarla a mano y de forma deliberada:
--     select public.purge_all_reservations_manual();
-- =============================================================================

-- Función de borrado MANUAL (sin programación automática).
create or replace function public.purge_all_reservations_manual()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.reservations;  -- reservation_extras cae por ON DELETE CASCADE
  raise notice 'purge_all_reservations_manual: todas las reservas borradas';
end;
$$;

-- Best-effort: desprogramar cualquier job de la versión anterior, si existiera.
do $$
begin
  perform cron.unschedule('purge-all-reservations-2026-06-21');
exception
  when others then null;  -- pg_cron/cron no disponible o job inexistente: ignorar
end $$;
