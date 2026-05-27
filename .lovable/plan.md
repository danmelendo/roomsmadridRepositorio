# Plan de implementación

## 1. Cambios de base de datos (migración)

**Tablas modificadas:**
- `rooms`: añadir `has_tv` (bool), `has_swing` (bool), `image_url` (ya existe — usar placeholders)
- `extras`: añadir `image_url`
- `customers`: añadir `no_contact` (bool, default false)
- `reservations`: añadir `deposit_amount` (numeric), `deposit_paid` (bool), `stripe_session_id` (text), `created_by_role` (text — "admin"/"reception"/"public")

**4ª persona:** ampliar lógica para usar el mismo recargo que la 3ª persona × (people − 2). Ya hay `people int`; sólo cambiar UI para permitir 4 y ajustar `pricing.ts`.

**RLS:** mantener policies actuales. Anon ya puede insertar reservations/customers/reservation_extras.

## 2. Pasarela de pago (Stripe built-in)

Habilitar `enable_stripe_payments`. Crear server route `/api/public/create-deposit-session` que:
- Recibe `reservation_id`
- Crea Stripe Checkout Session por el 30% del total
- Webhook `/api/public/stripe-webhook` marca `deposit_paid=true` y dispara email de confirmación

Por ahora, si Stripe no está habilitado al final, dejamos el botón "Pagar depósito" funcionando contra una server function que simula el pago marcando `deposit_paid=true` (modo prueba). Pero el plan asume Stripe activado.

## 3. Web pública (`/reservar`) — flujo nuevo estilo Booking

Páginas/rutas:
- `/reservar` — landing + selector de fecha/hora/duración/personas
- Dentro de la misma página, tras seleccionar fecha → grid de habitaciones disponibles con:
  - Imagen grande a la izquierda
  - Nombre, edificio, capacidad, badges (TV, Columpio, Jacuzzi)
  - "Desde XX€" calculado dinámicamente
  - Botón "Seleccionar"
- Al seleccionar habitación → form datos cliente (nombre, email, teléfono opcional, checkbox **"No quiero recibir comunicaciones"**, checkbox **"+18 confirmado"** obligatorio)
- Crea la reserva (sin extras) y muestra pantalla de **Extras** (cards con foto, precio, +/− cantidad)
- Botón "Continuar al pago" → Stripe Checkout 30%
- Tras éxito de pago: pantalla de confirmación + email automático

Disclaimer +18 visible en footer y en checkbox obligatorio.

## 4. Cambios internos

- **Reservas (`_app.reservations.tsx`):** mostrar columna "Creada por" (admin / recepción / web pública)
- **Notificaciones:** componente `NotificationBell` en header con realtime sobre `reservations` (INSERT). Sonido (audio HTML5 corto) + badge color según estado. Toast sonner con color por evento.
- **4ª persona:** Selector people pasa de máx 3 a máx 4 en dialog interno y público.

## 5. Archivos clave

```text
Nuevo:
  src/routes/api/public/create-deposit-session.ts
  src/routes/api/public/stripe-webhook.ts
  src/routes/reservar.tsx (reescrito)
  src/components/public/RoomCard.tsx
  src/components/public/ExtrasStep.tsx
  src/components/NotificationBell.tsx
  src/lib/notifications.tsx (sonido + provider)
  supabase/migrations/<nueva>.sql

Editado:
  src/lib/pricing.ts (4ª persona)
  src/components/NewReservationDialog.tsx (people max 4)
  src/routes/_app.reservations.tsx (columna creador)
  src/routes/_app.tsx (NotificationBell en header)
  supabase/functions/send-reservation-confirmation/index.ts (incluir depósito)
```

## 6. Detalles técnicos

- **Email de confirmación:** ya existe edge function. Se invocará tras webhook Stripe (no inmediatamente al crear reserva). Si Stripe no está activo, se invoca al crear reserva como fallback.
- **+18 disclaimer:** banner sticky en `/reservar` + checkbox bloqueante.
- **Realtime notif:** habilitar `ALTER PUBLICATION supabase_realtime ADD TABLE reservations`.
- **Imágenes placeholder:** generar 3-4 placeholders neutros con imagegen y reutilizar por habitación según `building`.

## 7. Orden de ejecución

1. Migración DB
2. Habilitar Stripe payments
3. Pricing.ts 4ª persona + UI internal max 4
4. Reescribir `/reservar` con flujo nuevo + ExtrasStep
5. Server routes Stripe + webhook
6. Notificaciones realtime
7. Columna creador en reservas
8. Probar flujo público end-to-end