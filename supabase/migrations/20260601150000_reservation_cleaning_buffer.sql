-- Cleaning buffer between reservations.
-- The client requires at least 15 minutes of cleaning between reservations in
-- the same room (the room is not reservable/occupiable during that time). Staff
-- can extend it per reservation when needed.

-- Per-reservation cleaning time (minutes) applied AFTER the reservation ends,
-- before the room can be used again. Minimum 15.
alter table reservations
  add column if not exists cleaning_minutes integer not null default 15;

alter table reservations
  drop constraint if exists reservations_cleaning_minutes_min;
alter table reservations
  add constraint reservations_cleaning_minutes_min check (cleaning_minutes >= 15);

-- Rewrite the gap check:
--  * The "occupied" window of a reservation is [start, end + cleaning_minutes).
--  * A new reservation conflicts if its occupied window overlaps an existing
--    blocking reservation's occupied window.
--  * Blocking reservations: confirmed / in_progress / completed always; pending
--    only while recent (60 min) so abandoned public payments free the slot.
--  * Manual reservations NO LONGER bypass the gap — the cleaning time is always
--    enforced (manual_override no longer skips this check).
create or replace function public.check_reservation_gap()
returns trigger
language plpgsql as $$
begin
  if new.status in ('cancelled', 'no_show', 'rejected') then
    return new;
  end if;
  if exists (
    select 1 from reservations r
    where r.room_id = new.room_id
      and r.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and (
        r.status in ('confirmed', 'in_progress', 'completed')
        or (r.status = 'pending' and r.created_at > now() - interval '60 minutes')
      )
      and tstzrange(r.start_at, r.end_at + make_interval(mins => coalesce(r.cleaning_minutes, 15)), '[)')
          && tstzrange(new.start_at, new.end_at + make_interval(mins => coalesce(new.cleaning_minutes, 15)), '[)')
  ) then
    raise exception 'Conflicto de reserva: la habitacion necesita al menos % minutos de limpieza entre reservas', coalesce(new.cleaning_minutes, 15);
  end if;
  return new;
end;
$$;
