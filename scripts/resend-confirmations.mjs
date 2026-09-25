// =============================================================================
// Reenvía los emails de confirmación que no llegaron a enviarse.
//
//   node scripts/resend-confirmations.mjs --since 2026-09-15            → lista candidatas (no envía)
//   node scripts/resend-confirmations.mjs --since 2026-09-15 --send     → envía
//   node scripts/resend-confirmations.mjs --since 2026-09-15 --until 2026-09-21 --send
//   node scripts/resend-confirmations.mjs --id <uuid-reserva>           → reenvía UNA reserva
//                                                                          (también sirve para probar
//                                                                          el SMTP tras cambiar la
//                                                                          contraseña)
//   ... --include-past                                                  → incluye estancias ya pasadas
//
// Candidatas = reservas web pagadas, confirmadas, creadas en [since, until],
// con la entrada aún por llegar y sin envío correcto registrado
// (`confirmation_email_sent_at`, migración 20260920220000). `--since` es
// obligatorio: las reservas anteriores a esa migración tienen la columna a NULL
// aunque el email sí se enviara en su día, así que sin cota inferior se
// reenviaría a clientes que ya lo recibieron.
//
// La selección se hace aquí con la SERVICE_ROLE_KEY del .env de la raíz; el
// envío lo hace la edge function `send-reservation-confirmation`, una llamada
// por reserva. La salida no contiene datos personales.
// =============================================================================

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = { ...process.env };
  const envPath = resolve(ROOT, ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const i = line.indexOf("=");
      if (i < 1 || line.trim().startsWith("#")) continue;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim().replace(/^"|"$/g, "");
      if (!(k in env)) env[k] = v;
    }
  }
  return env;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const flag = (name) => process.argv.includes(name);

const env = loadEnv();
const SUPABASE_URL = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}
const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };

/** Envía (o reenvía) la confirmación de una reserva vía edge function. */
async function sendOne(reservationId) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-reservation-confirmation`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reservation_id: reservationId }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) return `ERROR ${out.error ?? res.status}`;
  return out.via ?? (out.skipped ? `omitida: ${out.skipped}` : "ok");
}

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" }) : "";

async function main() {
  // ─── Modo reserva única ────────────────────────────────────────────────────
  const id = arg("--id");
  if (id) {
    console.log(`${id.slice(0, 8)}… → ${await sendOne(id)}`);
    return 0;
  }

  // ─── Modo lote ─────────────────────────────────────────────────────────────
  const since = arg("--since");
  const until = arg("--until");
  const send = flag("--send");
  if (!since) {
    console.error("Uso: --since YYYY-MM-DD [--until YYYY-MM-DD] [--include-past] [--send]   |   --id <uuid>");
    return 1;
  }

  const filters = [
    "created_by_role=eq.public",
    "deposit_paid=eq.true",
    "status=eq.confirmed",
    "confirmation_email_sent_at=is.null",
    `created_at=gte.${since}`,
    ...(until ? [`created_at=lte.${until}`] : []),
    ...(flag("--include-past") ? [] : [`start_at=gt.${new Date().toISOString()}`]),
  ];
  const query =
    "select=id,created_at,start_at,total,paid_amount,confirmation_email_error,rooms(name,building)" +
    `&${filters.join("&")}&order=start_at.asc`;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/reservations?${query}`, { headers });
  if (!res.ok) {
    console.error(`Consulta fallida: HTTP ${res.status}`, await res.text());
    return 1;
  }
  const candidates = await res.json();

  console.log(
    `${send ? "ENVÍO" : "LISTADO (sin enviar)"} · web pagadas y confirmadas, sin email registrado, ` +
      `creadas desde ${since}${until ? ` hasta ${until}` : ""}${flag("--include-past") ? "" : ", con entrada futura"}`,
  );
  if (candidates.length === 0) {
    console.log("No hay reservas pendientes de confirmación.");
    return 0;
  }

  const rows = [];
  for (const c of candidates) {
    const room = c.rooms ? `${c.rooms.building} · ${c.rooms.name}` : null;
    rows.push({
      id: c.id.slice(0, 8),
      creada: fmt(c.created_at),
      entrada: fmt(c.start_at),
      sala: room,
      total: c.total,
      pagado: c.paid_amount,
      ultimo_error: (c.confirmation_email_error ?? "").slice(0, 40),
      ...(send ? { resultado: await sendOne(c.id) } : {}),
    });
  }
  console.table(rows);
  if (send) {
    const ok = rows.filter((r) => r.resultado === "smtp").length;
    console.log(`enviadas=${ok} · fallidas=${rows.length - ok} de ${rows.length}`);
    return rows.length === ok ? 0 : 1;
  }
  console.log(`${rows.length} candidata(s). Para enviar de verdad añade --send`);
  return 0;
}

process.exitCode = await main();
