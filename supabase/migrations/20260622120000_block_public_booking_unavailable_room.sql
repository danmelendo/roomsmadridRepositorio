-- =============================================================================
-- Impide que una reserva PÚBLICA (web) se cree sobre una habitación cuyo estado
-- manual no sea 'available' (ocupada / limpieza / fuera de servicio).
--
-- Contexto: el flujo público comprobaba la disponibilidad solo por solape de
-- horarios, ignorando el campo rooms.status. Una habitación puesta "Fuera de
-- servicio" desde el panel seguía siendo reservable. Esta comprobación es la
-- red de seguridad a nivel de BD: aunque el frontend esté desactualizado, el
-- INSERT se rechaza.
--
-- Solo afecta a created_by_role = 'public'. El personal (admin/recepción) puede
-- seguir creando reservas en cualquier habitación.
-- =============================================================================

create or replace function public.check_room_available_for_public()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  -- Solo se aplica a reservas creadas desde la web pública.
  if new.created_by_role is distinct from 'public' then
    return new;
  end if;

  select status::text into v_status from public.rooms where id = new.room_id;

  if v_status is distinct from 'available' then
    raise exception 'La habitación seleccionada no está disponible para reservar (estado: %).', coalesce(v_status, 'desconocido')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_room_available_for_public on public.reservations;
create trigger trg_check_room_available_for_public
  before insert on public.reservations
  for each row execute function public.check_room_available_for_public();
