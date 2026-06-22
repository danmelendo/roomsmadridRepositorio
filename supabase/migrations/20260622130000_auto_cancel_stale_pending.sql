-- =============================================================================
-- Auto-cancelación de reservas PENDIENTES abandonadas (sin pagar).
--
-- Problema: cuando un cliente reserva en la web y no paga el depósito, la reserva
-- queda en estado 'pending' indefinidamente y hay que cancelarla a mano. El
-- trigger de solapes ya las ignora pasados 60 min (no bloquean el horario), pero
-- seguían apareciendo como pendientes en el panel.
--
-- Esta función marca como 'rejected' las pendientes sin pagar de más de 60 min.
-- Se programa con pg_cron cada 15 min (best-effort: si pg_cron no está habilitado
-- la función queda creada y se puede ejecutar a mano o desde un scheduler externo).
-- =============================================================================

create or replace function public.cancel_stale_pending_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.reservations
     set status = 'rejected'
   where status = 'pending'
     and deposit_paid = false
     and created_at < now() - interval '60 minutes';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Asegurar pg_cron (puede requerir habilitarlo en Dashboard > Database > Extensions).
do $$ begin
  create extension if not exists pg_cron;
exception when others then null;
end $$;

-- Quitar una programación previa con el mismo nombre, si existiera.
do $$ begin
  perform cron.unschedule('cancel-stale-pending');
exception when others then null;
end $$;

-- Programar cada 15 minutos.
do $$ begin
  perform cron.schedule(
    'cancel-stale-pending',
    '*/15 * * * *',
    $cron$ select public.cancel_stale_pending_reservations(); $cron$
  );
exception when others then
  raise notice 'pg_cron no disponible: cancel_stale_pending_reservations() creada pero NO programada. Habilita pg_cron en el Dashboard.';
end $$;
