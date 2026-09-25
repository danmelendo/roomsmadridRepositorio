// =============================================================================
// Exporta un dataset ANONIMIZADO de reservas para machine learning
// (predicción de cancelaciones).
//
//   node ml/export_reservations_dataset.mjs            → ml/dataset/*.csv|md|json
//   node ml/export_reservations_dataset.mjs --out DIR  → otra carpeta de salida
//
// Lee de Supabase con la SERVICE_ROLE_KEY del .env de la raíz (solo lectura).
// NUNCA emite datos personales: de `customers` solo se leen id/created_at/
// no_contact y el id se sustituye por un entero secuencial (customer_key).
// Los textos libres (internal_notes, bed/screen_message, cancellation_reason)
// se reducen a booleanos o a una categoría; el texto nunca se escribe.
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TZ = "Europe/Madrid";

// ─── Config ──────────────────────────────────────────────────────────────────
const argOut = process.argv.indexOf("--out");
const OUT_DIR = argOut > -1 ? resolve(process.argv[argOut + 1]) : resolve(__dirname, "dataset");

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

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function fetchAll(table, select, orderCol = "created_at") {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .order(orderCol, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

/**
 * Prod y repo pueden divergir (migraciones no aplicadas). Sondea cada columna
 * opcional con un select de 1 fila y descarta las que no existan.
 */
async function pickColumns(table, required, optional) {
  const ok = [...required];
  const missing = [];
  for (const col of optional) {
    const { error } = await sb.from(table).select(col).limit(1);
    if (error) missing.push(col); else ok.push(col);
  }
  if (missing.length) console.log(`  ${table}: columnas ausentes en prod → ${missing.join(", ")}`);
  return ok.join(",");
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
});
/** Descompone un ISO en partes locales (Europe/Madrid). dow ISO: 1=lunes … 7=domingo. */
function local(iso) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).filter(x => x.type !== "literal").map(x => [x.type, x.value]));
  const jsDow = DOW.indexOf(p.weekday);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour) % 24,
    dow: jsDow === 0 ? 7 : jsDow,
    month: Number(p.month),
    year: Number(p.year),
  };
}

// Mismo criterio que buildingKey() en src/lib/data.ts
function buildingKey(b) {
  const s = (b ?? "").toLowerCase();
  if (s.includes("bernab")) return "bernabeu";
  if (s.includes("venta")) return "ventas";
  if (s.includes("ameri") || s.includes("amér")) return "america";
  return s;
}

/**
 * Categoriza el motivo de cancelación sin exportar el texto libre (puede contener
 * nombres). Heurística por palabras clave sobre los textos que escribe recepción.
 * IMPORTANTE: el personal usa status=cancelled también para los NO-SHOW («no vino»,
 * «no llegó»…); el enum no_show no se usa en la práctica. De ahí la categoría.
 */
function reasonCategory(txt, status) {
  const t = (txt ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (status === "rejected") {
    if (/autom[aá]tica|no recibido en 60/.test(t)) return "auto_unpaid";
    return "payment_failed"; // rechazo TPV o "Pago no completado por el cliente"
  }
  if (!t || /^[.\-0]+$/.test(t) || t === "no") return "unspecified";
  if (/dupli/.test(t)) return "duplicate";
  if (/error|prueba|test|equivoc|borr/.test(t)) return "error_or_test";
  if (/cambi|mueve|mover|movi|reprogram|otra fecha|otro d[ií]a|otra hora|aplaz|pospon|adelant/.test(t)) return "rescheduled";
  if (/no (contesta|contesto|contestó|responde|respondio|respondió|coge|atiende)|sin respuesta|ilocalizable|no confirm/.test(t)) return "unreachable";
  if (/no (pago|pagó|realizo el pago|realizó el pago|ha pagado|abon)|sin pagar|impago/.test(t)) return "unpaid";
  // Aviso previo del cliente (llamó / escribió / avisó) → cancelación anticipada aunque diga "no viene"
  if (/llam|escribi|avis|cancel|anul|no puede|no podia|no podía|no pudo|no va a (venir|poder)|imprevisto|enferm/.test(t)) return "customer_cancelled";
  if (/no (vino|llego|llegó|viene|asisti|asistió|se presento|se presentó|aparec|acudi)|nunca vino|no asiste|plant/.test(t)) return "no_show";
  return "other";
}

const r2 = (n) => (n == null || Number.isNaN(n) ? "" : Math.round(n * 100) / 100);
const b01 = (v) => (v ? 1 : 0);
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "–");

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows, columns) {
  const lines = [columns.join(",")];
  for (const r of rows) lines.push(columns.map(c => csvEscape(r[c])).join(","));
  return lines.join("\n") + "\n";
}

// ─── Extracción ──────────────────────────────────────────────────────────────
console.log("Comprobando columnas disponibles…");
const reservationCols = await pickColumns("reservations",
  ["id", "room_id", "customer_id", "start_at", "end_at", "with_jacuzzi", "people", "is_overnight",
    "base_price", "third_person_surcharge", "dynamic_surcharge", "extras_total", "total", "status",
    "created_at", "updated_at"],
  ["paid_amount", "deposit_amount", "deposit_paid", "dynamic_reason", "manual_override", "created_by_role",
    "redsys_order", "bed_message", "screen_message", "cleaning_minutes", "promo_code_id", "discount_amount",
    "cancellation_reason", "internal_notes"]);
const roomCols = await pickColumns("rooms",
  ["id", "building", "name", "capacity", "rate_group_id"],
  ["jacuzzi", "has_tv", "has_swing", "allows_overnight", "active"]);
// ⚠️ customers: SOLO estas columnas, nada de name/phone/email/notes.
const customerCols = await pickColumns("customers", ["id", "created_at"], ["no_contact"]);

console.log("Descargando tablas…");
const [reservations, rooms, rateGroups, customers, resExtras, extras, promos] = await Promise.all([
  fetchAll("reservations", reservationCols),
  fetchAll("rooms", roomCols, "name"),
  fetchAll("rate_groups", "id,name", "name"),
  fetchAll("customers", customerCols),
  fetchAll("reservation_extras", "reservation_id,extra_id,qty,unit_price,is_gift").catch(e => (console.log("  reservation_extras:", e.message), [])),
  fetchAll("extras", "id,category,name,price", "name").catch(e => (console.log("  extras:", e.message), [])),
  fetchAll("promo_codes", "id,discount_type,discount_value,single_use").catch(e => (console.log("  promo_codes:", e.message), [])),
]);
console.log(`  reservations=${reservations.length} rooms=${rooms.length} customers=${customers.length} reservation_extras=${resExtras.length}`);

const EXPORTED_AT = new Date();
const roomById = new Map(rooms.map(r => [r.id, r]));
const rateGroupById = new Map(rateGroups.map(g => [g.id, g.name]));
const customerById = new Map(customers.map(c => [c.id, c]));
const extraById = new Map(extras.map(e => [e.id, e]));
const promoById = new Map(promos.map(p => [p.id, p]));

// Extras agrupados por reserva
const extrasByRes = new Map();
for (const re of resExtras) {
  if (!extrasByRes.has(re.reservation_id)) extrasByRes.set(re.reservation_id, []);
  extrasByRes.get(re.reservation_id).push(re);
}

// Clave anónima de cliente: entero por orden de alta (no reversible sin la BD).
const customerKey = new Map();
[...customers].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((c, i) => customerKey.set(c.id, i + 1));

// ─── Derivación de outcome / target ──────────────────────────────────────────
function outcomeOf(r) {
  switch (r.status) {
    case "completed":
    case "in_progress": return "honored";
    case "confirmed": return new Date(r.end_at) < EXPORTED_AT ? "honored" : "upcoming";
    case "cancelled": return "cancelled";
    case "no_show": return "no_show";
    case "rejected": return "rejected";
    case "pending": return "pending";
    default: return r.status;
  }
}

// ─── Construcción de filas (orden cronológico para el histórico del cliente) ──
reservations.sort((a, b) => a.created_at.localeCompare(b.created_at));
const histByCustomer = new Map(); // customer_id → reservas anteriores ya procesadas
const rows = [];

for (const r of reservations) {
  const room = roomById.get(r.room_id) ?? {};
  const cust = r.customer_id ? customerById.get(r.customer_id) : null;
  const start = new Date(r.start_at), end = new Date(r.end_at), created = new Date(r.created_at), updated = new Date(r.updated_at);
  const sl = local(r.start_at), cl = local(r.created_at);
  const outcome = outcomeOf(r);
  const isPublic = r.created_by_role === "public";

  // Extras
  const ex = extrasByRes.get(r.id) ?? [];
  const cat = { decoration: 0, drinks: 0, hookah: 0, accessories: 0, services: 0 };
  let qty = 0, gifts = 0;
  const names = [];
  for (const line of ex) {
    const e = extraById.get(line.extra_id);
    qty += line.qty ?? 0;
    if (line.is_gift) gifts++;
    if (e) { cat[e.category] = (cat[e.category] ?? 0) + (line.qty ?? 0); names.push(e.name); }
  }

  // Histórico del cliente en el momento de crear la reserva (sin fuga de información:
  // solo cuenta resultados que ya eran conocidos en created_at).
  const prev = r.customer_id ? (histByCustomer.get(r.customer_id) ?? []) : [];
  const known = (p) => new Date(p.updated_at) <= created; // cancel/no_show/rejected ya registrado
  const prevHonored = prev.filter(p => p._outcome === "honored" && new Date(p.end_at) <= created).length;
  const prevCancelled = prev.filter(p => p.status === "cancelled" && known(p)).length;
  const prevNoShow = prev.filter(p => p.status === "no_show" && known(p)).length;
  const prevRejected = prev.filter(p => p.status === "rejected" && known(p)).length;
  const prevResolved = prevHonored + prevCancelled + prevNoShow;
  const lastPrev = prev.length ? prev[prev.length - 1] : null;

  const promo = r.promo_code_id ? promoById.get(r.promo_code_id) : null;
  const total = Number(r.total) || 0;

  rows.push({
    // Identificación (opaca)
    reservation_id: r.id,
    customer_key: cust ? customerKey.get(cust.id) : "",

    // Target y estado
    status: r.status,
    outcome,
    target_cancelled: outcome === "honored" ? 0 : (outcome === "cancelled" || outcome === "no_show") ? 1 : "",
    honored_assumed: b01(r.status === "confirmed" && outcome === "honored"),

    // Sala
    room_name: room.name ?? "",
    building: buildingKey(room.building),
    rate_group: rateGroupById.get(room.rate_group_id) ?? "",
    room_capacity: room.capacity ?? "",
    room_jacuzzi_option: room.jacuzzi ?? "",
    room_has_tv: b01(room.has_tv),
    room_has_swing: b01(room.has_swing),
    room_allows_overnight: b01(room.allows_overnight),

    // Cuándo se reserva / cuándo es el servicio
    created_at: r.created_at,
    created_local_date: cl.date,
    created_local_hour: cl.hour,
    created_dow: cl.dow,
    start_at: r.start_at,
    end_at: r.end_at,
    start_local_date: sl.date,
    start_local_hour: sl.hour,
    start_dow: sl.dow,
    start_is_weekend: b01(sl.dow >= 6),
    start_is_fri_sat: b01(sl.dow === 5 || sl.dow === 6),
    start_month: sl.month,
    start_year: sl.year,
    duration_min: Math.round((end - start) / 60000),
    lead_time_hours: r2((start - created) / 3.6e6),
    lead_time_days: r2((start - created) / 8.64e7),
    is_overnight: b01(r.is_overnight),

    // Canal y configuración
    created_by_role: r.created_by_role ?? "",
    created_via_web: b01(isPublic),
    with_jacuzzi: b01(r.with_jacuzzi),
    people: r.people,
    has_third_person: b01((r.people ?? 0) > 2),
    manual_override: b01(r.manual_override),
    cleaning_minutes: r.cleaning_minutes ?? "",
    customer_no_contact: cust ? b01(cust.no_contact) : "",

    // Importes
    base_price: r2(Number(r.base_price)),
    third_person_surcharge: r2(Number(r.third_person_surcharge)),
    dynamic_surcharge: r2(Number(r.dynamic_surcharge)),
    has_dynamic_surcharge: b01(Number(r.dynamic_surcharge) > 0),
    dynamic_reason: r.dynamic_reason ?? "",
    extras_total: r2(Number(r.extras_total)),
    discount_amount: r2(Number(r.discount_amount)),
    total: r2(total),
    deposit_amount: r2(Number(r.deposit_amount)),
    deposit_ratio: total > 0 ? r2(Number(r.deposit_amount) / total) : "",
    deposit_paid: b01(r.deposit_paid),
    paid_amount: r2(Number(r.paid_amount)),
    paid_ratio: total > 0 ? r2(Number(r.paid_amount) / total) : "",
    has_online_payment: b01(!!r.redsys_order),

    // Promo
    has_promo: b01(!!r.promo_code_id),
    promo_discount_type: promo?.discount_type ?? "",
    promo_discount_value: promo ? r2(Number(promo.discount_value)) : "",
    promo_single_use: promo ? b01(promo.single_use) : "",

    // Extras
    n_extras_lines: ex.length,
    extras_qty_total: qty,
    extras_gift_count: gifts,
    extras_decoration_qty: cat.decoration,
    extras_drinks_qty: cat.drinks,
    extras_hookah_qty: cat.hookah,
    extras_accessories_qty: cat.accessories,
    extras_services_qty: cat.services,
    extras_names: names.join("|"),
    has_bed_message: b01(!!(r.bed_message && r.bed_message.trim())),
    has_screen_message: b01(!!(r.screen_message && r.screen_message.trim())),
    has_internal_notes: b01(!!(r.internal_notes && r.internal_notes.trim())),

    // Histórico del cliente (point-in-time)
    cust_is_new: b01(prev.length === 0),
    cust_prev_bookings: prev.length,
    cust_prev_honored: prevHonored,
    cust_prev_cancelled: prevCancelled,
    cust_prev_no_show: prevNoShow,
    cust_prev_rejected: prevRejected,
    cust_prev_cancel_rate: prevResolved ? r2((prevCancelled + prevNoShow) / prevResolved) : "",
    cust_days_since_first_seen: cust ? r2((created - new Date(cust.created_at)) / 8.64e7) : "",
    cust_days_since_prev_booking: lastPrev ? r2((created - new Date(lastPrev.created_at)) / 8.64e7) : "",

    // ⚠️ POST-HOC (solo se conocen tras el desenlace; NO usar como features)
    updated_at: r.updated_at,
    hours_from_last_update_to_start: r2((start - updated) / 3.6e6),
    cancellation_reason_category: reasonCategory(r.cancellation_reason, r.status),
  });

  if (r.customer_id) {
    if (!histByCustomer.has(r.customer_id)) histByCustomer.set(r.customer_id, []);
    histByCustomer.get(r.customer_id).push({ ...r, _outcome: outcome });
  }
}

// ─── Resumen estadístico ─────────────────────────────────────────────────────
function tally(list, keyFn) {
  const m = new Map();
  for (const x of list) { const k = keyFn(x); m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function cancelRateBy(list, keyFn, order) {
  const g = new Map();
  for (const x of list) {
    if (x.target_cancelled === "") continue;
    const k = keyFn(x);
    const e = g.get(k) ?? { n: 0, c: 0 };
    e.n++; e.c += x.target_cancelled; g.set(k, e);
  }
  const entries = [...g.entries()];
  return order === "key" ? entries.sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true })) : entries.sort((a, b) => b[1].n - a[1].n);
}
const mdTable = (headers, body) => [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...body.map(r => `| ${r.join(" | ")} |`)].join("\n");
const leadBucket = (h) => h === "" ? "9 n/a" : h < 0 ? "0 <0h (alta a posteriori)" : h < 6 ? "1 0-6h" : h < 24 ? "2 6-24h" : h < 72 ? "3 1-3d" : h < 168 ? "4 3-7d" : h < 720 ? "5 7-30d" : "6 >30d";

const N = rows.length;
const labelled = rows.filter(r => r.target_cancelled !== "");
const cancelledN = labelled.filter(r => r.target_cancelled === 1).length;
const cancelledOnly = rows.filter(r => r.status === "cancelled");
const md = [];
md.push(`# Resumen del dataset de reservas — Rooms Madrid`);
md.push(`Exportado: ${EXPORTED_AT.toISOString()} · Reservas: **${N}** · Clientes distintos: **${new Set(rows.map(r => r.customer_key).filter(Boolean)).size}**`);
md.push(`Rango \`start_at\`: ${rows.map(r => r.start_local_date).sort()[0]} → ${rows.map(r => r.start_local_date).sort().at(-1)} · Rango \`created_at\`: ${rows[0]?.created_local_date} → ${rows.at(-1)?.created_local_date}\n`);

md.push(`## Distribución por \`status\` (crudo)`);
md.push(mdTable(["status", "n", "%"], tally(rows, r => r.status).map(([k, n]) => [k, n, pct(n, N)])));
md.push(`\n## Distribución por \`outcome\` (derivado)`);
md.push(mdTable(["outcome", "n", "%"], tally(rows, r => r.outcome).map(([k, n]) => [k, n, pct(n, N)])));
md.push(`\n## Target de ML (\`target_cancelled\`: 1 = cancelled/no_show, 0 = honored)`);
md.push(`- Filas etiquetadas: **${labelled.length}** (${pct(labelled.length, N)} del total)`);
md.push(`- Positivos (canceladas + no_show): **${cancelledN}** → tasa de cancelación **${pct(cancelledN, labelled.length)}**`);
md.push(`- \`honored\` asumidas por fecha pasada sin marcar \`completed\`: ${rows.filter(r => r.honored_assumed === 1).length}`);
md.push(`- Excluidas del target: rejected=${rows.filter(r => r.outcome === "rejected").length}, pending=${rows.filter(r => r.outcome === "pending").length}, upcoming=${rows.filter(r => r.outcome === "upcoming").length}`);
md.push(`\n## Motivo de cancelación (categorizado por palabras clave) — status \`cancelled\``);
md.push(`> El personal marca como \`cancelled\` tanto cancelaciones anticipadas como no-shows; el enum \`no_show\` no se usa. Usa \`cancellation_reason_category\` para separarlos.\n`);
md.push(mdTable(["categoría", "n", "% de canceladas"], tally(cancelledOnly, r => r.cancellation_reason_category).map(([k, n]) => [k, n, pct(n, cancelledOnly.length)])));
const rejectedOnly = rows.filter(r => r.status === "rejected");
md.push(`\n## Motivo — status \`rejected\` (pago web no completado)`);
md.push(mdTable(["categoría", "n", "% de rechazadas"], tally(rejectedOnly, r => r.cancellation_reason_category).map(([k, n]) => [k, n, pct(n, rejectedOnly.length)])));

const rateSection = (title, keyFn, order) => {
  md.push(`\n## Tasa de cancelación por ${title}`);
  md.push(mdTable([title, "reservas", "canceladas", "tasa"], cancelRateBy(labelled, keyFn, order).map(([k, e]) => [k, e.n, e.c, pct(e.c, e.n)])));
};
rateSection("canal (`created_by_role`)", r => r.created_by_role || "(null)");
rateSection("edificio", r => r.building || "(null)");
rateSection("sala", r => r.room_name || "(null)");
rateSection("mes de servicio", r => r.start_local_date.slice(0, 7), "key");
rateSection("día de la semana del servicio (1=lun … 7=dom)", r => r.start_dow, "key");
rateSection("antelación de la reserva", r => leadBucket(r.lead_time_hours), "key");
rateSection("cliente nuevo vs recurrente", r => r.cust_is_new ? "nuevo" : "recurrente");
rateSection("depósito pagado", r => r.deposit_paid ? "sí" : "no");
rateSection("con promo", r => r.has_promo ? "sí" : "no");
rateSection("noche completa", r => r.is_overnight ? "sí" : "no");

md.push(`\n## Estados × canal`);
const roles = [...new Set(rows.map(r => r.created_by_role || "(null)"))];
const statuses = [...new Set(rows.map(r => r.status))];
md.push(mdTable(["status", ...roles], statuses.map(s => [s, ...roles.map(ro => rows.filter(r => r.status === s && (r.created_by_role || "(null)") === ro).length)])));

const summary = md.join("\n") + "\n";

// ─── Escritura ───────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
const columns = Object.keys(rows[0] ?? {});
writeFileSync(resolve(OUT_DIR, "reservations_dataset.csv"), "﻿" + toCsv(rows, columns), "utf8");
writeFileSync(resolve(OUT_DIR, "summary.md"), summary, "utf8");
writeFileSync(resolve(OUT_DIR, "dataset_meta.json"), JSON.stringify({
  exported_at: EXPORTED_AT.toISOString(),
  timezone: TZ,
  rows: N,
  columns,
  by_status: Object.fromEntries(tally(rows, r => r.status)),
  by_outcome: Object.fromEntries(tally(rows, r => r.outcome)),
  labelled_rows: labelled.length,
  positives: cancelledN,
}, null, 2), "utf8");

console.log(summary);
console.log(`\nEscrito en ${OUT_DIR}:\n  reservations_dataset.csv (${N} filas × ${columns.length} columnas)\n  summary.md\n  dataset_meta.json`);
