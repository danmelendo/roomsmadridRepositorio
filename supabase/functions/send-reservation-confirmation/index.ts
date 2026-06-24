// Confirmation email for public reservations — enviado por SMTP (cuenta del
// propio dominio, p. ej. reservas@roomsmadrid.es) tras confirmarse el pago.
// Secrets necesarios (Supabase → Edge Functions → Secrets):
//   SMTP_HOST, SMTP_PORT (465 SSL / 587 STARTTLS), SMTP_TLS ("true"/"false"),
//   SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  reservation_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { reservation_id } = (await req.json()) as Body;
    if (!reservation_id) throw new Error("reservation_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: r, error } = await supabase
      .from("reservations")
      .select("*, rooms(name,building), customers(name,email)")
      .eq("id", reservation_id)
      .maybeSingle();
    if (error) throw error;
    if (!r) throw new Error("Reserva no encontrada");

    const { data: extraRows } = await supabase
      .from("reservation_extras")
      .select("qty, is_gift, bed_message, screen_message, extras(name)")
      .eq("reservation_id", reservation_id);

    const email: string | null = r.customers?.email ?? null;
    if (!email) {
      console.log("No customer email; skipping send");
      return json({ ok: true, skipped: "no_email" });
    }

    const eur = (n: number) =>
      new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
    const fmt = (d: Date) =>
      d.toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Madrid" });

    const totalNum = Number(r.total ?? 0);
    const paidNum = Number(r.paid_amount ?? 0);
    const remainingNum = Math.max(0, Math.round((totalNum - paidNum) * 100) / 100);
    const reference = r.redsys_order ?? String(r.id).slice(0, 8).toUpperCase();

    const html = buildEmailHtml({
      name: r.customers?.name ?? "",
      building: r.rooms?.building ?? "",
      room: r.rooms?.name ?? "",
      checkIn: fmt(new Date(r.start_at)),
      checkOut: fmt(new Date(r.end_at)),
      people: Number(r.people ?? 0),
      total: eur(totalNum),
      depositPaid: !!r.deposit_paid && paidNum > 0,
      deposit: eur(paidNum),
      remaining: eur(remainingNum),
      reference,
      extrasHtml: buildExtrasHtml(extraRows ?? []),
    });

    const subject = "Confirmación de tu reserva · Rooms Madrid";

    const smtpHost = Deno.env.get("SMTP_HOST");
    if (!smtpHost) {
      console.log("SMTP_HOST no configurado; no se envía. Destinatario:", email);
      return json({ ok: true, skipped: "no_smtp" });
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: Number(Deno.env.get("SMTP_PORT") ?? "465"),
        tls: (Deno.env.get("SMTP_TLS") ?? "true") !== "false", // 465→true, 587→false
        auth: {
          username: Deno.env.get("SMTP_USERNAME") ?? "reservas@roomsmadrid.es",
          password: Deno.env.get("SMTP_PASSWORD") ?? "",
        },
      },
    });
    try {
      await client.send({
        from: Deno.env.get("SMTP_FROM") ?? "Rooms Madrid <reservas@roomsmadrid.es>",
        to: email,
        subject,
        // Quitar espacios/tabs al final de cada línea: evita el artefacto "=20"
        // del quoted-printable cuando una línea queda solo con indentación.
        html: html.replace(/[ \t]+$/gm, ""),
        content: "Tu reserva está confirmada. Abre este correo en un cliente compatible con HTML para ver los detalles.",
      });
    } finally {
      await client.close();
    }

    return json({ ok: true, via: "smtp" });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Plantilla del email (estética Rooms Madrid: rojo insignia + negro + crema) ──
interface EmailData {
  name: string; building: string; room: string;
  checkIn: string; checkOut: string; people: number;
  total: string; depositPaid: boolean; deposit: string; remaining: string;
  reference: string; extrasHtml: string;
}

function buildEmailHtml(d: EmailData) {
  const row = (label: string, value: string, top = true) =>
    `<tr><td style="padding:9px 0;color:#7a7066;font-size:14px;${top ? "border-top:1px solid rgba(115,20,35,0.12);" : ""}">${escapeHtml(label)}</td>` +
    `<td style="padding:9px 0;text-align:right;color:#0b0c0c;font-size:14px;font-weight:600;${top ? "border-top:1px solid rgba(115,20,35,0.12);" : ""}">${value}</td></tr>`;

  const paymentRows = d.depositPaid
    ? `<tr><td style="padding:6px 0;font-size:13px;color:rgba(255,255,255,0.6);border-top:1px solid rgba(255,255,255,0.14);">Pagado online (depósito)</td>
         <td style="padding:6px 0;text-align:right;font-size:15px;font-weight:700;color:#86e29b;border-top:1px solid rgba(255,255,255,0.14);">${escapeHtml(d.deposit)}</td></tr>
       <tr><td style="padding:6px 0;font-size:13px;color:rgba(255,255,255,0.6);">Pendiente en el hotel</td>
         <td style="padding:6px 0;text-align:right;font-size:14px;color:#cf7a89;">${escapeHtml(d.remaining)}</td></tr>`
    : `<tr><td style="padding:6px 0;font-size:12px;color:rgba(255,255,255,0.5);" colspan="2">El pago se realiza en el hotel.</td></tr>`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Playfair:wght@500;600;700&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#f6f3ec;font-family:'Noto Sans',Arial,Helvetica,sans-serif;color:#0b0c0c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ec;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf9;border-radius:16px;overflow:hidden;border:1px solid rgba(115,20,35,0.18);">
        <tr><td style="background:#0b0c0c;border-bottom:3px solid #731423;padding:26px 32px;text-align:center;">
          <div style="font-family:'Playfair',Georgia,serif;font-size:24px;font-weight:600;letter-spacing:0.16em;color:#cf7a89;text-transform:uppercase;">ROOMS <span style="color:#ffffff;">MADRID</span></div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 6px;font-family:'Playfair',Georgia,serif;font-size:28px;font-weight:600;color:#0b0c0c;">¡Reserva confirmada!</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#7a7066;line-height:1.6;">Hola ${escapeHtml(d.name)}, gracias por reservar con Rooms Madrid. Estos son los detalles de tu reserva:</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ec;border:1px solid rgba(115,20,35,0.18);border-radius:12px;margin-bottom:18px;">
            <tr><td style="padding:16px 20px 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#731423;font-weight:700;">RM ${escapeHtml(d.building)}</td></tr>
            <tr><td style="padding:0 20px 16px;font-family:'Playfair',Georgia,serif;font-size:22px;color:#0b0c0c;">${escapeHtml(d.room)}</td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${row("Entrada", escapeHtml(d.checkIn), false)}
            ${row("Salida", escapeHtml(d.checkOut))}
            ${row("Personas", String(d.people))}
          </table>

          ${d.extrasHtml}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;background:#0b0c0c;border-radius:12px;">
            <tr><td style="padding:16px 20px 6px;font-size:13px;color:rgba(255,255,255,0.6);">Total reserva</td>
                <td style="padding:16px 20px 6px;text-align:right;font-family:'Playfair',Georgia,serif;font-size:20px;color:#ffffff;">${escapeHtml(d.total)}</td></tr>
            <tr><td colspan="2" style="padding:0 20px 14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${paymentRows}</table>
            </td></tr>
          </table>

          <p style="margin:24px 0 0;font-size:13px;color:#7a7066;line-height:1.6;">Si necesitas modificar o cancelar tu reserva, contáctanos por teléfono o WhatsApp. Reservas solo para mayores de 18 años.</p>
        </td></tr>
        <tr><td style="background:#0b0c0c;border-top:2px solid #731423;padding:18px 32px;text-align:center;">
          <div style="font-size:12px;color:rgba(255,255,255,0.55);">Rooms Madrid · Habitaciones temáticas con jacuzzi en Madrid</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:6px;letter-spacing:0.06em;">Referencia: ${escapeHtml(d.reference)}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

interface ExtraRow {
  qty: number;
  is_gift: boolean;
  bed_message: string | null;
  screen_message: string | null;
  extras: { name: string } | { name: string }[] | null;
}

function buildExtrasHtml(rows: ExtraRow[]) {
  if (!rows.length) return "";
  const items = rows
    .map((row) => {
      const ex = Array.isArray(row.extras) ? row.extras[0] : row.extras;
      const name = ex?.name ?? "Extra";
      const qtyLabel = row.qty > 1 ? ` × ${row.qty}` : "";
      const giftLabel = row.is_gift ? ' <span style="color:#731423;font-weight:600;">(regalo)</span>' : "";
      const messages: string[] = [];
      if (row.bed_message?.trim())
        messages.push(`Frase en la cama: <strong>${escapeHtml(row.bed_message.trim())}</strong>`);
      if (row.screen_message?.trim())
        messages.push(`Frase en el cristal / pantalla LED: <strong>${escapeHtml(row.screen_message.trim())}</strong>`);
      const messagesHtml = messages.length
        ? `<div style="font-size:12px;color:#7a7066;margin-top:3px;">${messages.join("<br>")}</div>`
        : "";
      return `<li style="margin:7px 0;color:#3a3530;">${escapeHtml(name)}${qtyLabel}${giftLabel}${messagesHtml}</li>`;
    })
    .join("");
  return `
    <h2 style="margin:24px 0 8px;font-family:'Playfair',Georgia,serif;font-size:17px;color:#0b0c0c;">Extras</h2>
    <ul style="margin:0;padding-left:18px;font-size:14px;list-style:disc;">${items}</ul>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
