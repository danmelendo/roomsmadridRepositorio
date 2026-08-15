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
_(ninguna)_

Las tres salas nuevas de RM Ventas ya están dadas de alta en `supabase/migrations/`
(cada una con `rate_group` propio y tarifas independientes):
- **El Cairo** y **Miami** — `20260717120000` + `20260717121000` (tarifas copiadas de
  Music/Empire). Activas (`active=true`, `status=available`).
- **Bali Deluxe** — `20260813120000` (tarifas copiadas de Grey). **Activa**
  (`active=true`, `status=available`) desde 2026-08-15, con fotos en
  `public/imagenes/Ventas/Bali Deluxe/`, slug `balideluxeventas`, badge de
  columpio y descripción. NO lleva pantalla ni cubo LED.
