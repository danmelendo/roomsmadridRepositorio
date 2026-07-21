# Migraciones pendientes (NO aplicadas)

Los `.sql` de esta carpeta **no** los ejecuta el CLI de Supabase: solo escanea
`supabase/migrations/`. Sirven para dejar cambios de BD preparados pero
inactivos hasta que se dé el visto bueno.

## Activar una migración pendiente
1. Rellenar los `TODO` del fichero (precios, flags de sala, etc.).
2. Descomentar el cuerpo SQL.
3. Mover el fichero a `supabase/migrations/` y renombrarlo con un timestamp
   fresco (`YYYYMMDDHHMMSS_...sql`).
4. Aplicar con `supabase db push` (o el flujo de despliegue habitual).

## Pendientes actuales
- `20260701_add_ventas_rooms_miami_bali_cairo.sql` — **solo queda Bali Deluxe**.
  El Cairo y Miami ya se dieron de alta (con tarifas independientes copiadas de
  Music/Empire) en la migración aplicada
  `supabase/migrations/20260717120000_add_ventas_rooms_cairo_miami.sql`, con
  `active = false` (visibles en la agenda interna, ocultas en la web pública
  hasta que el personal las active y lleguen las fotos).
  Para Bali Deluxe siguen aplicando los `TODO` gemelos del frontend:
  `src/lib/roomSlugs.ts` (enlaces) y `src/routes/reservar.tsx`
  (fotos, descripciones y flags pantalla/cubo LED/columpio).
