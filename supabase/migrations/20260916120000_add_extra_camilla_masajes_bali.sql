-- ═══════════════════════════════════════════════════════════════════════════
-- Nuevo extra "Camilla de masajes" (15 €), SOLO para Bali Deluxe (RM Ventas).
--
-- Petición del cliente: camilla de masajes a disposición de los huéspedes de
-- Bali. Categoría `accessories`, junto a los columpios (sort 40/41).
--
-- La restricción "solo Bali" NO vive en la BD: `extras` no tiene relación con
-- `rooms`. Igual que el columpio y el cubo LED, la web pública lo filtra por
-- nombre de sala en `src/routes/reservar.tsx` (`ROOMS_WITH_MASSAGE_TABLE` +
-- `isMassageTableExtra` en `extraAvailableForRoom`). El panel interno muestra
-- todos los extras en todas las salas (igual que hoy con el columpio).
--
-- Idempotente: `extras.name` no es unique, así que se comprueba a mano.
-- No pisa ediciones manuales posteriores (precio, descripción, active).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

insert into extras (category, name, price, description, active, sort_order)
select 'accessories'::extra_category,
       'Camilla de masajes',
       15.00,
       'Camilla de masajes a vuestra disposición (solo Bali Deluxe)',
       true,
       42
where not exists (
  select 1 from extras where lower(name) = 'camilla de masajes'
);

commit;
