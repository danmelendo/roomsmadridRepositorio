# Esquema de Base de Datos — Rooms Madrid (Supabase / PostgreSQL)

> Documento de referencia generado desde `supabase/migrations/`. Objetivo: no
> tener que reexplorar todo el árbol de migraciones en cada consulta.
> **Si cambias el esquema (nueva migración que altere tablas/enums/funciones),
> actualiza también este archivo.**
>
> Convenciones del repo:
> - Migraciones aplicadas: `supabase/migrations/` (el CLI solo ejecuta esta carpeta).
> - Migraciones preparadas pero NO aplicadas: `supabase/pending-migrations/`.
> - Casi todas las migraciones son **idempotentes** (`if not exists`, `on conflict`).
> - El string `building` NO es un enum: se normaliza en el front con `buildingKey()`
>   (`src/lib/data.ts`) a las claves `bernabeu` | `ventas` | `america`. El panel de
>   Habitaciones agrupa por el string EXACTO, así que al insertar salas hay que
>   reutilizar el mismo `building` que las salas hermanas (ver migración
>   `20260601170000_fix_grey_bernabeu_building.sql`).

## Enums

| Tipo | Valores |
|------|---------|
| `room_status` | `available`, `occupied`, `cleaning`, `out_of_service` |
| `reservation_status` | `confirmed`, `in_progress`, `completed`, `cancelled`, `no_show`, **`pending`**, **`rejected`** *(los 2 últimos añadidos en `20260601140000`)* |
| `jacuzzi_option` | `none`, `optional`, `always` |
| `dynamic_rule_type` | `occupancy`, `date` |
| `extra_category` | `decoration`, `drinks`, `hookah`, `accessories`, `services` |
| `app_role` | `admin`, `reception`, `customer` |

## Tablas

### `rate_groups`
Grupo de tarifas compartible entre varias salas.
- `id` uuid PK
- `name` text **unique**
- `created_at` timestamptz
- ⚠️ **Los nombres en PRODUCCIÓN difieren de los de las migraciones del repo**: se
  renombraron/dividieron a mano en la BD y ese cambio NO está en `migrations/`.
  Nombres REALES en prod (jul-2026): `Grey`, `Ruta 66`, **`Music/Empire`**,
  **`Paris/Space/Ocean`**, **`Dubai/TuYYo/NewYork`**, `Hollywood`, **`Maldivas`**,
  **`Tokyo`**, `El Cairo`, `Miami`.
  (En el repo figuran como `Music/Empire/Paris/Space/Ocean`, `Dubai/Tu y Yo/New York`,
  `Maldivas (sin jacuzzi)`, `Tokyo (sin jacuzzi)`.) → **Al copiar/referenciar tarifas,
  hazlo DATA-DRIVEN por la sala** (`rooms.rate_group_id` de una sala conocida), NUNCA
  por el nombre del grupo, que puede haber cambiado. Ver `20260717121000`.
- `El Cairo` y `Miami` añadidos en `20260717120000` + `20260717121000` con tarifas
  INDEPENDIENTES (copiadas de `Music/Empire`).
- ⚠️ Los **precios reales en prod también se editaron a mano** desde el panel de
  Tarifas y difieren de los valores de `20260506170000_update_tarifas.sql`
  (p.ej. Music/Empire 60min = 45 €, no 43/38). El panel es la fuente de verdad.

### `rooms`
- `id` uuid PK
- `building` text — string libre (ver nota arriba)
- `name` text
- `jacuzzi` `jacuzzi_option` default `optional` (en la práctica casi todas `always`; Maldivas/Tokyo `none`)
- `capacity` int default 2
- `status` `room_status` default `available`
- `rate_group_id` uuid → `rate_groups(id)` ON DELETE SET NULL
- `description` text
- `image_url` text *(añadida en `20260512145658`)*
- `has_tv` bool default false *(añadida en `20260512145658`)*
- `has_swing` bool default false *(añadida en `20260512145658`)*
- `allows_overnight` bool default true *(añadida en `20260618120000`; toggle admin para noche completa por sala)*
- `active` bool default true — **la web pública filtra `active = true`; el panel/agenda muestra todas**
- `sort_order` int default 0 — orden en calendario y panel *(valores por defecto en `20260608120000`)*
- `created_at` timestamptz
- **unique (building, name)**

> Nota: las prestaciones de la web pública (pantalla, cubo LED, columpio, fotos,
> descripciones, slugs) NO viven todas en la BD; parte están hardcodeadas por
> nombre de sala en `src/routes/reservar.tsx` y `src/lib/roomSlugs.ts`.

### `rate_hourly`
Tarifa por horas de un grupo.
- `id` uuid PK
- `rate_group_id` uuid → `rate_groups(id)` ON DELETE CASCADE
- `duration_min` int (60,90,120,150,180,210,240,270,300,330,360)
- `price_with_jacuzzi` numeric(10,2) — null si no aplica
- `price_without_jacuzzi` numeric(10,2)
- **unique (rate_group_id, duration_min)**

### `rate_overnight`
Tarifa de noche completa (solo dom–mié de entrada; la disponibilidad la impone la app).
- `id` uuid PK
- `rate_group_id` uuid → `rate_groups(id)` ON DELETE CASCADE
- `checkout_time` time (típico `10:00`, `11:00`, `12:00`)
- `price` numeric(10,2) NOT NULL
- **unique (rate_group_id, checkout_time)**
- ⚠️ `pricing.ts` usa la fila **10:00** como base; si falta o es null, la noche sale a 0 €.

### `rate_third_person`
Suplemento global por persona extra.
- `id` uuid PK · `duration_min` int **unique** · `surcharge` numeric(10,2)

### `dynamic_rules`
Reglas de precio dinámico (ocupación o fecha).
- `id` uuid PK · `type` `dynamic_rule_type` · `name` text · `config` jsonb default `{}` ·
  `multiplier` numeric(5,2) · `active` bool default true · `created_at`

### `extras`
Catálogo de extras.
- `id` uuid PK · `category` `extra_category` · `name` text · `price` numeric(10,2) ·
  `description` text · `active` bool default true · `sort_order` int · `created_at`

### `gift_thresholds`
Regalo automático al superar un gasto en extras.
- `id` uuid PK · `min_extras_total` numeric(10,2) **unique** ·
  `gift_extra_id` uuid → `extras(id)` ON DELETE CASCADE · `active` bool

### `customers`
- `id` uuid PK · `name` · `phone` · `email` · `notes` · `created_at`
- index `customers_phone_idx (phone)`

### `reservations`
Tabla central.
- `id` uuid PK
- `room_id` uuid → `rooms(id)` ON DELETE RESTRICT
- `customer_id` uuid → `customers(id)` ON DELETE SET NULL
- `start_at` / `end_at` timestamptz — **check (end_at > start_at)**
- `with_jacuzzi` bool · `people` int default 2 · `is_overnight` bool
- `base_price`, `third_person_surcharge`, `dynamic_surcharge`, `extras_total`, `total`,
  `paid_amount`, `deposit_amount` numeric(10,2) — importes
- `dynamic_reason` text · `internal_notes` text
- `status` `reservation_status` default `confirmed`
- `manual_override` bool default false *(añadida en `20260507124325`; salta el gap de limpieza)*
- `no_contact` bool default false *(añadida en `20260512145658`)*
- `deposit_paid` bool default false · `created_by_role` text *(`public` = reserva web)* *(`20260512145658`)*
- `redsys_order` text *(era `stripe_session_id`, renombrada en `20260519140000`)* · `paid_amount` *(re-add `20260519140000`)*
- `bed_message`, `screen_message` text *(mensajes de decoración, `20260601120000`)*
- `cleaning_minutes` int default 15 *(buffer de limpieza, `20260601150000`)*
- `promo_code_id` uuid → `promo_codes(id)` ON DELETE SET NULL · `discount_amount` numeric default 0 *(`20260610120000`)*
- `cancellation_reason` text *(`20260622140000`)*
- `created_by` uuid → `auth.users(id)` · `created_at` · `updated_at` (trigger `set_updated_at`)
- indexes: `(room_id, start_at, end_at)`, `(start_at)`

### `reservation_extras`
- `id` uuid PK · `reservation_id` → `reservations(id)` CASCADE · `extra_id` → `extras(id)` RESTRICT ·
  `qty` int · `unit_price` numeric(10,2) · `is_gift` bool · `created_at`
- index `(reservation_id)`

### `promo_codes` *(`20260610120000`)*
- `id` uuid PK · `code` text · `discount_type` (`percent`|`fixed`) · `discount_value` numeric>0 ·
  `valid_from` · `valid_until` (null = sin caducidad) · `single_use` bool · `max_uses` int ·
  `times_used` int · `active` bool · `archived` bool · `created_at`
- unique index `upper(code) where not archived`
- Solo aplica al precio de la HABITACIÓN (nunca a extras).

### `user_roles` *(`20260507124325`)*
- `id` uuid PK · `user_id` → `auth.users(id)` CASCADE · `role` `app_role` · unique (user_id, role)
- Signup asigna `reception` automáticamente (trigger `on_auth_user_created` → `handle_new_user`).

### `audit_log`
- `id` uuid PK · `entity` · `entity_id` · `action` · `user_id` → `auth.users(id)` · `payload` jsonb · `at`

## Triggers y funciones clave

- **`check_reservation_gap()`** (BEFORE INSERT/UPDATE en `reservations`): impide solapes;
  exige `cleaning_minutes` (default 15) de separación. Se salta si `status` ∈ {cancelled, no_show, rejected}
  o si `manual_override = true`. Bloquea contra reservas confirmed/in_progress/completed y pending recientes (<60 min).
- **`check_room_available_for_public()`** (BEFORE INSERT, trigger `trg_check_room_available_for_public`):
  rechaza reservas con `created_by_role = 'public'` si `rooms.status <> 'available'`. Red de seguridad a nivel BD.
- **`extend_cleaning_and_shift(reservation_id, minutes)`**: alarga limpieza de una reserva y
  empuja las siguientes en cadena. SECURITY DEFINER.
- **`cancel_stale_pending_reservations()`** *(`20260622130000`)*: auto-cancela pendientes caducadas.
- **`purge_all_reservations_manual()`** *(`20260618220000`)*: purga total (⚠️ ver memoria: la migración
  de purga programada está neutralizada).
- **`validate_promo_code(code)`** / **`redeem_promo_code(id)`** / **`archive_expired_promo_codes()`**: flujo de promos.
- **`find_or_create_customer(...)`** *(`20260601142000`)*: alta/reutilización de cliente en el flujo público.
- **`has_role(user_id, role)`** + **`handle_new_user()`**: modelo de roles.
- **`set_updated_at()`**: mantiene `reservations.updated_at`.

## RLS (Row Level Security)
- RLS activo en todas las tablas de negocio.
- Patrón general: los usuarios **authenticated** (personal) tienen SELECT/INSERT/UPDATE/DELETE
  (`auth_all_*`) sobre las tablas de negocio.
- El sitio **anónimo/público** no lee tablas sensibles directamente; opera vía RPC SECURITY DEFINER
  (p.ej. `validate_promo_code`, `find_or_create_customer`) y con políticas anon acotadas
  (`20260528100000_fix_anon_rls_policies`, `20260601143000_relax_anon_insert_status`).
- `user_roles`: cada usuario ve sus roles; solo `admin` los gestiona.

## Notas operativas (ver también `memory/`)
- **Redsys**: `REDSYS_ENVIRONMENT=test` hace que "confirme pero no cobre". App real en
  `reservas.roomsmadrid.es`. Edge function y frontend se despliegan por separado.
- **Añadir una sala**: reutiliza el `building` de las hermanas, asigna `rate_group_id`,
  `sort_order`, y decide `active` (false = solo agenda interna hasta lanzarla). Si necesita
  tarifas independientes, crea su propio `rate_group` y copia filas de `rate_hourly`/`rate_overnight`
  (patrón en `20260717120000_add_ventas_rooms_cairo_miami.sql`).
