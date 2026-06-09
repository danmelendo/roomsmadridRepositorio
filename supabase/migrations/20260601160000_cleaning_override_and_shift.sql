-- 1) Admin override: reservations flagged manual_override may skip the cleaning
--    gap (intentional, for one-off exceptions only).
create or replace function public.check_reservation_gap()
returns trigger
language plpgsql as $$
begin
  if new.status in ('cancelled', 'no_show', 'rejected') then
    return new;
  end if;
  if new.manual_override then
    return new; -- admin override: skip the cleaning/gap check for special cases
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

-- 2) Extend the cleaning time of a reservation and push the following
--    reservations forward so they only start once cleaning has finished.
--    Returns the number of subsequent reservations that were rescheduled.
create or replace function public.extend_cleaning_and_shift(
  p_reservation_id uuid,
  p_cleaning_minutes integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  a            reservations%rowtype;
  r            reservations%rowtype;
  v_new_clean  integer;
  v_req        timestamptz;   -- earliest allowed start for the next reservation
  v_dur        interval;
  ids          uuid[]        := '{}';
  starts       timestamptz[] := '{}';
  ends         timestamptz[] := '{}';
  i            integer;
  v_moved      integer       := 0;
begin
  select * into a from reservations where id = p_reservation_id;
  if not found then
    raise exception 'Reserva no encontrada';
  end if;

  v_new_clean := greatest(15, coalesce(p_cleaning_minutes, 15));
  v_req := a.end_at + make_interval(mins => v_new_clean);

  -- Build the chain of subsequent reservations that need shifting (ascending),
  -- preserving each one's duration. Stop as soon as a gap absorbs the delay.
  for r in
    select * from reservations
    where room_id = a.room_id
      and id <> a.id
      and start_at >= a.start_at
      and status in ('confirmed', 'in_progress', 'completed', 'pending')
    order by start_at asc
  loop
    exit when r.start_at >= v_req;
    v_dur  := r.end_at - r.start_at;
    ids    := array_append(ids, r.id);
    starts := array_append(starts, v_req);
    ends   := array_append(ends, v_req + v_dur);
    v_req  := v_req + v_dur + make_interval(mins => coalesce(r.cleaning_minutes, 15));
  end loop;

  -- Apply the shifts latest-first so each update lands in already-cleared space
  -- (avoids transient overlaps tripping the gap trigger).
  if array_length(ids, 1) is not null then
    for i in reverse array_length(ids, 1) .. 1 loop
      update reservations set start_at = starts[i], end_at = ends[i] where id = ids[i];
      v_moved := v_moved + 1;
    end loop;
  end if;

  update reservations set cleaning_minutes = v_new_clean where id = a.id;

  return v_moved;
end;
$$;

grant execute on function public.extend_cleaning_and_shift(uuid, integer) to authenticated;
