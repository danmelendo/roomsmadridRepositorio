-- =============================================================================
-- Seguimiento del email de confirmación al cliente.
--
-- Incidente 15/09/2026: el buzón SMTP (reservas@roomsmadrid.es) empezó a
-- rechazar la contraseña ("535: Incorrect authentication data"). Los pagos se
-- confirmaban pero ningún cliente recibía el email, y no quedaba rastro: la
-- edge function `redsys-notification` descartaba el error de
-- `send-reservation-confirmation` y no había forma de saber a qué reservas
-- había que reenviar la confirmación.
--
-- Estas dos columnas las escribe SOLO `send-reservation-confirmation`:
--   - `confirmation_email_sent_at`: momento del último envío SMTP correcto
--     (NULL = nunca enviado; en filas anteriores a esta migración es
--     desconocido, por eso el reenvío masivo exige un `since`).
--   - `confirmation_email_error`: último error de envío; se limpia al enviar.
-- =============================================================================

alter table public.reservations
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists confirmation_email_error text;

comment on column public.reservations.confirmation_email_sent_at is
  'Último envío correcto del email de confirmación al cliente (NULL = no enviado / desconocido).';
comment on column public.reservations.confirmation_email_error is
  'Último error al enviar el email de confirmación; NULL tras un envío correcto.';
