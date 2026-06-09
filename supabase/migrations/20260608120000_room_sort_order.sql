-- Set the default room display order requested by the client.
-- The calendar (and admin rooms page) order rooms by `sort_order`.
-- Values are assigned in per-building blocks so the "all hotels" calendar
-- view stays grouped by building, while each building keeps the desired
-- internal order. Match is case-insensitive on building + name.

begin;

-- RM Bernabéu: Tokyo, Ocean, Paris, Safari, Grey
update rooms set sort_order = 1  where lower(building) like '%bernab%' and lower(name) = 'tokyo';
update rooms set sort_order = 2  where lower(building) like '%bernab%' and lower(name) = 'ocean';
update rooms set sort_order = 3  where lower(building) like '%bernab%' and lower(name) = 'paris';
update rooms set sort_order = 4  where lower(building) like '%bernab%' and lower(name) = 'safari';
update rooms set sort_order = 5  where lower(building) like '%bernab%' and lower(name) = 'grey';

-- RM Ventas: Route 66, Hollywood, Empire State, Music, Grey
update rooms set sort_order = 11 where lower(building) like '%venta%'  and lower(name) = 'route 66';
update rooms set sort_order = 12 where lower(building) like '%venta%'  and lower(name) = 'hollywood';
update rooms set sort_order = 13 where lower(building) like '%venta%'  and lower(name) = 'empire state';
update rooms set sort_order = 14 where lower(building) like '%venta%'  and lower(name) = 'music';
update rooms set sort_order = 15 where lower(building) like '%venta%'  and lower(name) = 'grey';

-- RM América: Tu y yo, Grey, New York, Dubai, Maldivas
update rooms set sort_order = 21 where (lower(building) like '%ameri%' or lower(building) like '%amér%') and lower(name) = 'tu y yo';
update rooms set sort_order = 22 where (lower(building) like '%ameri%' or lower(building) like '%amér%') and lower(name) = 'grey';
update rooms set sort_order = 23 where (lower(building) like '%ameri%' or lower(building) like '%amér%') and lower(name) = 'new york';
update rooms set sort_order = 24 where (lower(building) like '%ameri%' or lower(building) like '%amér%') and lower(name) = 'dubai';
update rooms set sort_order = 25 where (lower(building) like '%ameri%' or lower(building) like '%amér%') and lower(name) = 'maldivas';

commit;
