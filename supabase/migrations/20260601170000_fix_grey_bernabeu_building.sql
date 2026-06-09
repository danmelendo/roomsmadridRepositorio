-- Fix: the "Grey" room of RM Bernabéu was inserted with building = 'bernabeu'
-- (lowercase), while the other Bernabéu rooms (Safari, Paris, Ocean, Tokyo) use
-- a different casing/accent. The admin Rooms page groups by the exact building
-- string, so Grey showed up in a separate group.
--
-- Align Grey's building with the value used by the majority of the other
-- Bernabéu rooms (data-driven, so we don't hardcode the exact casing/accent).
update rooms
set building = sub.b
from (
  select building as b
  from rooms
  where lower(building) like 'bernab%'
    and lower(name) <> 'grey'
  group by building
  order by count(*) desc
  limit 1
) sub
where lower(rooms.building) like 'bernab%'
  and lower(rooms.name) = 'grey'
  and rooms.building <> sub.b;
