-- =============================================================================
-- Motivo de cancelación.
--
-- Permite saber POR QUÉ se canceló/rechazó una reserva: por un operario (texto
-- libre obligatorio al pulsar la X), por rechazo de pago, o por la cancelación
-- automática de pendientes sin pagar.
-- =============================================================================

alter table public.reservations
  add column if not exists cancellation_reason text;

-- La auto-cancelación de pendientes ahora deja constancia del motivo.
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
     set status = 'rejected',
         cancellation_reason = 'Cancelación automática: pago no recibido en 60 min'
   where status = 'pending'
     and deposit_paid = false
     and created_at < now() - interval '60 minutes';
  get diagnostics n = row_count;
  return n;
end;
$$;
